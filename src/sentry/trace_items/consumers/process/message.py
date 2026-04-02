import logging
import types
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.batching import ValuesBatch
from arroyo.types import FilteredPayload, Message
from django.conf import settings
from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry import features
from sentry.constants import InsightModules
from sentry.event_manager import INSIGHT_MODULE_TO_PROJECT_FLAG_NAME
from sentry.insights import FilterSpan
from sentry.insights import modules as insights_modules
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.receivers.features import record_generic_event_processed
from sentry.signals import first_insight_span_received, first_transaction_received
from sentry.trace_items.create_models import create_environment_and_release_models
from sentry.utils import metrics
from sentry.utils.dates import to_datetime
from sentry.utils.projectflags import set_project_flag_and_signal

logger = logging.getLogger(__name__)


SUPPORTED_ITEM_TYPES: set[TraceItemType.ValueType] = {
    TraceItemType.TRACE_ITEM_TYPE_SPAN,
    TraceItemType.TRACE_ITEM_TYPE_LOG,
}


@metrics.wraps("trace_items.consumers.process.message.filter_message")
def filter_message(message: Message[FilteredPayload | KafkaPayload]) -> bool:
    """Filter out unsupported types via headers. (If the item_type header is
    missing, the message is kept.)"""

    # FilterStep has no commit_policy, so FilteredPayloads won't be received.
    assert not isinstance(message.payload, FilteredPayload)

    headers = dict(message.payload.headers)
    item_type_header = headers.get("item_type")
    if item_type_header is not None:
        try:
            item_type_value = int(item_type_header.decode("ascii"))
        except (ValueError, UnicodeDecodeError):
            item_type_value = None

        if item_type_value is not None and item_type_value not in SUPPORTED_ITEM_TYPES:
            return False

    return True


@dataclass(frozen=True)
class ModelPermutation:
    project: Project
    environment: str | None
    release: str | None
    dist: str | None


def process_batch(message: Message[ValuesBatch[KafkaPayload]]) -> None:
    sample_rate = (
        settings.SENTRY_PROCESS_TRACE_ITEMS_TRANSACTIONS_SAMPLE_RATE
        * settings.SENTRY_PROCESS_EVENT_APM_SAMPLING
    )
    with sentry_sdk.start_transaction(
        name="trace_items.consumers.process.message.process_batch",
        custom_sampling_context={
            "sample_rate": sample_rate,
        },
    ):
        _process_batch(message)


def _process_batch(message: Message[ValuesBatch[KafkaPayload]]) -> None:
    model_permutations: dict[ModelPermutation, datetime] = dict()
    seen_insights_modules: defaultdict[Project, set[InsightModules]] = defaultdict(set)
    segment_spans: defaultdict[Project, list[TraceItem]] = defaultdict(list)

    for item in message.payload:
        try:
            trace_item = TraceItem()
            trace_item.ParseFromString(item.payload.value)
        except Exception:
            logger.exception("process_batch.invalid_protobuf")
            continue

        if trace_item.item_type not in SUPPORTED_ITEM_TYPES:
            continue

        try:
            project = Project.objects.get_from_cache(id=trace_item.project_id)
            project.set_cached_field_value(
                "organization",
                Organization.objects.get_from_cache(id=project.organization_id),
            )
        except (Project.DoesNotExist, Organization.DoesNotExist):
            # If the project or org does not exist then it might have been deleted during ingestion.
            continue

        if not features.has(
            "organizations:trace-items-consumer-model-creation", project.organization
        ):
            continue

        model_permutation, timestamp = _model_permutation_for_trace_item(trace_item, project)
        if timestamp:
            current_timestamp = model_permutations.get(model_permutation, timestamp)
            model_permutations[model_permutation] = min(timestamp, current_timestamp)

        if trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_SPAN:
            seen_insights_modules[project].update(_insights_modules_for_span(trace_item))

            is_segment = _extract_bool(trace_item, "sentry.is_segment") or False
            if is_segment:
                segment_spans[project].append(trace_item)

    # Attributes to observe the batching behaviour.
    if span := sentry_sdk.get_current_span():
        span.update_data(
            {
                "trace_items.process_consumer.items.count": len(message.payload),
                "trace_items.process_consumer.model_permutations.count": len(model_permutations),
                "trace_items.process_consumer.seen_insights_modules.project_count": len(
                    seen_insights_modules
                ),
                "trace_items.process_consumer.seen_insights_modules.modules_count": sum(
                    len(v) for v in seen_insights_modules.values()
                ),
                "trace_items.process_consumer.segment_spans.project_count": len(segment_spans),
                "trace_items.process_consumer.segment_spans.spans_count": sum(
                    len(v) for v in segment_spans.values()
                ),
            }
        )

    if model_permutations:
        _create_models(model_permutations)
    if segment_spans:
        _record_segment_signals(segment_spans)
    if seen_insights_modules:
        _signal_insights_spans_received(seen_insights_modules)


@sentry_sdk.trace(name="trace_items.consumers.process.message._create_models")
def _create_models(model_permutations: dict[ModelPermutation, datetime]):
    if span := sentry_sdk.get_current_span():
        span.set_data("model_permutations.count", len(model_permutations))

    for mp, date in model_permutations.items():
        create_environment_and_release_models(
            project=mp.project,
            environment_name=mp.environment,
            release_name=mp.release,
            dist_name=mp.dist,
            date=date,
        )


@sentry_sdk.trace(name="trace_items.consumers.process.message._record_segment_signals")
def _record_segment_signals(segment_spans: dict[Project, list[TraceItem]]):
    if span := sentry_sdk.get_current_span():
        span.set_data("segment_spans.count", len(segment_spans))

    for project, trace_items in segment_spans.items():
        timestamps = [
            timestamp for item in trace_items if (timestamp := _timestamp_from_span(item))
        ]
        earliest_timestamp = min(timestamps) if timestamps else None
        event_like = types.SimpleNamespace(datetime=earliest_timestamp)
        set_project_flag_and_signal(
            project,
            "has_transactions",
            first_transaction_received,
            event=event_like,
        )

        for item in trace_items:
            record_generic_event_processed(
                project,
                platform=_extract_string(item, ATTRIBUTE_NAMES.SENTRY_PLATFORM),
                release=_extract_string(item, ATTRIBUTE_NAMES.SENTRY_RELEASE),
                environment=_extract_string(item, ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT),
            )


@sentry_sdk.trace(name="trace_items.consumers.process.message.signal_insights_spans_received")
def _signal_insights_spans_received(
    seen_insights_modules: dict[Project, set[InsightModules]],
):
    if span := sentry_sdk.get_current_span():
        span.set_data("seen_insights_modules.count", len(seen_insights_modules))

    for project, modules in seen_insights_modules.items():
        for module in modules:
            set_project_flag_and_signal(
                project,
                INSIGHT_MODULE_TO_PROJECT_FLAG_NAME[module],
                first_insight_span_received,
                module=module,
            )


def _model_permutation_for_trace_item(
    trace_item: TraceItem,
    project: Project,
) -> tuple[ModelPermutation, datetime | None]:
    model_permutation = ModelPermutation(
        project=project,
        environment=_extract_string(trace_item, ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT),
        release=_extract_string(trace_item, ATTRIBUTE_NAMES.SENTRY_RELEASE),
        dist=_extract_string(trace_item, ATTRIBUTE_NAMES.SENTRY_DIST),
    )
    timestamp = _timestamp_from_trace_item(trace_item)
    return (model_permutation, timestamp)


def _insights_modules_for_span(span: TraceItem):
    filter_span = FilterSpan(
        op=_extract_string(span, ATTRIBUTE_NAMES.SENTRY_OP),
        category=_extract_string(span, "sentry.category"),
        description=_extract_string(span, ATTRIBUTE_NAMES.SENTRY_DESCRIPTION),
        transaction_op=_extract_string(span, "sentry.transaction_op"),
        gen_ai_op_name=_extract_string(span, ATTRIBUTE_NAMES.GEN_AI_OPERATION_NAME),
    )
    return insights_modules([filter_span])


def _timestamp_from_span(span: TraceItem) -> datetime | None:
    end_ts = _extract_double(span, "sentry.end_timestamp_precise")
    return to_datetime(end_ts)


def _timestamp_from_trace_item(trace_item: TraceItem) -> datetime | None:
    if trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_SPAN:
        return _timestamp_from_span(trace_item)
    else:
        return trace_item.timestamp.ToDatetime(tzinfo=timezone.utc)


def _extract_string(item: TraceItem, key: str) -> str | None:
    attr = item.attributes.get(key)
    if attr is None:
        return None
    if attr.WhichOneof("value") == "string_value":
        return attr.string_value
    return None


def _extract_double(item: TraceItem, key: str) -> float | None:
    attr = item.attributes.get(key)
    if attr is None:
        return None
    kind = attr.WhichOneof("value")
    if kind == "double_value":
        return attr.double_value
    if kind == "int_value":
        return float(attr.int_value)
    return None


def _extract_bool(item: TraceItem, key: str) -> bool | None:
    attr = item.attributes.get(key)
    if attr is None:
        return None
    if attr.WhichOneof("value") == "bool_value":
        return attr.bool_value
    return None
