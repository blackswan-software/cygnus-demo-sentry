from datetime import datetime, timezone
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic, Value
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry.signals import first_transaction_received
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.trace_items.consumers.process.message import (
    filter_message,
    process_batch,
)


def make_kafka_message(
    headers: list[tuple[str, bytes]] | None = None,
) -> Message[KafkaPayload]:
    return Message(Value(KafkaPayload(None, b"", headers or []), {}))


def test_no_item_type_header():
    assert filter_message(make_kafka_message()) is True


def test_supported_span_type():
    span_item_type = bytes(str(TraceItemType.TRACE_ITEM_TYPE_SPAN), "ascii")
    assert filter_message(make_kafka_message([("item_type", span_item_type)])) is True


def test_supported_log_type():
    log_item_type = bytes(str(TraceItemType.TRACE_ITEM_TYPE_LOG), "ascii")
    assert filter_message(make_kafka_message([("item_type", log_item_type)])) is True


def test_unsupported_type_filtered():
    occurrence_item_type = bytes(str(TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE), "ascii")
    assert filter_message(make_kafka_message([("item_type", occurrence_item_type)])) is False


def test_invalid_non_numeric_header():
    assert filter_message(make_kafka_message([("item_type", b"abc")])) is True


def test_invalid_non_ascii_header():
    assert filter_message(make_kafka_message([("item_type", b"\xff")])) is True


def _make_trace_item(
    item_type: TraceItemType.ValueType,
    project_id: int,
    organization_id: int,
    environment: str | None = None,
    release: str | None = None,
    dist: str | None = None,
    platform: str | None = None,
    op: str | None = None,
    description: str | None = None,
    category: str | None = None,
    is_segment: bool = False,
    timestamp: datetime | None = None,
) -> TraceItem:
    item = TraceItem()
    item.project_id = project_id
    item.organization_id = organization_id
    item.item_type = item_type
    if environment:
        item.attributes["sentry.environment"].CopyFrom(AnyValue(string_value=environment))
    if release:
        item.attributes["sentry.release"].CopyFrom(AnyValue(string_value=release))
    if dist:
        item.attributes["sentry.dist"].CopyFrom(AnyValue(string_value=dist))
    if platform:
        item.attributes["sentry.platform"].CopyFrom(AnyValue(string_value=platform))
    if is_segment:
        item.attributes["sentry.is_segment"].CopyFrom(AnyValue(bool_value=True))
    if op:
        item.attributes["sentry.op"].CopyFrom(AnyValue(string_value=op))
    if description:
        item.attributes["sentry.description"].CopyFrom(AnyValue(string_value=description))
    if category:
        item.attributes["sentry.category"].CopyFrom(AnyValue(string_value=category))

    timestamp = timestamp or datetime.now()
    if item_type == TraceItemType.TRACE_ITEM_TYPE_SPAN:
        item.attributes["sentry.end_timestamp_precise"].CopyFrom(
            AnyValue(double_value=timestamp.timestamp())
        )
    else:
        item.timestamp.FromDatetime(timestamp)

    return item


def _make_batch_message(trace_items: list[TraceItem]) -> Message:
    topic = Topic("snuba-items")
    partition = Partition(topic, 0)
    now = datetime.now(timezone.utc)
    broker_values = [
        BrokerValue(
            KafkaPayload(None, item.SerializeToString(), []),
            partition,
            i,
            now,
        )
        for i, item in enumerate(trace_items)
    ]
    return Message(Value(broker_values, {partition: len(trace_items)}))


class TestProcessBatch(TestCase):
    def setUp(self):
        super().setUp()
        self.project_a = self.create_project(
            organization=self.organization,
            name="Project A",
        )
        self.project_b = self.create_project(
            organization=self.organization,
            name="Project B",
        )

    @mock.patch(
        "sentry.trace_items.consumers.process.message.create_environment_and_release_models"
    )
    def test_model_permutations_joins(self, mock_create):
        # Model permutations work for any supported trace item type.
        segment_span = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="production",
            release="a@1",
            dist="foo",
            is_segment=True,
            timestamp=datetime(2026, 4, 1),
        )
        child_span = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="production",
            release="a@1",
            dist="foo",
            is_segment=False,
            timestamp=datetime(2026, 3, 1),
        )
        log = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="production",
            release="a@1",
            dist="foo",
            timestamp=datetime(2026, 2, 1),
        )
        message = _make_batch_message([segment_span, child_span, log])

        with Feature({"organizations:trace-items-consumer-model-creation": True}):
            process_batch(message)

        # Since all items share the same project, environment, release, and
        # dist, they should collapse into a single call.
        mock_create.assert_called_once_with(
            project=self.project_a,
            environment_name="production",
            release_name="a@1",
            dist_name="foo",
            date=datetime(2026, 2, 1, tzinfo=timezone.utc),
        )

    @mock.patch(
        "sentry.trace_items.consumers.process.message.create_environment_and_release_models"
    )
    def test_model_permutations_skips_unsupported_types(self, mock_create):
        unsupported_type = TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE
        unsupported_trace_item = _make_trace_item(
            item_type=unsupported_type,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="production",
            release="a@1",
            dist="foo",
        )
        message = _make_batch_message([unsupported_trace_item])

        with Feature({"organizations:trace-items-consumer-model-creation": True}):
            process_batch(message)

        # Since unsupported types should be skipped, we shouldn't try to create
        # a model for this item.
        mock_create.assert_not_called()

    @mock.patch(
        "sentry.trace_items.consumers.process.message.create_environment_and_release_models"
    )
    def test_model_permutations_differs_by_values(self, mock_create):
        base_item = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="foo",
            release="foo",
            dist="foo",
        )
        different_project = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_b.id,
            organization_id=self.organization.id,
            environment="foo",
            release="foo",
            dist="foo",
        )
        different_environment = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="bar",
            release="foo",
            dist="foo",
        )
        different_release = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="foo",
            release="bar",
            dist="foo",
        )
        different_dist = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="foo",
            release="foo",
            dist="bar",
        )
        message = _make_batch_message(
            [
                base_item,
                different_project,
                different_environment,
                different_release,
                different_dist,
            ]
        )

        with Feature({"organizations:trace-items-consumer-model-creation": True}):
            process_batch(message)

        # Since all items differ by either project, environment, release, or
        # dist, they should each produce a distinct call.
        assert mock_create.call_count == 5

    @mock.patch("sentry.trace_items.consumers.process.message.set_project_flag_and_signal")
    @mock.patch("sentry.trace_items.consumers.process.message.record_generic_event_processed")
    def test_segment_signals_recorded(
        self, mock_record_generic_event_processed, mock_set_project_flag_and_signal
    ):
        a1 = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="e",
            release="r",
            platform="p",
            is_segment=True,
        )
        a2 = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="e",
            release="r",
            platform="p",
            is_segment=True,
        )
        b1 = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_b.id,
            organization_id=self.organization.id,
            environment="e",
            release="r",
            platform="p",
            is_segment=True,
        )
        message = _make_batch_message([a1, a2, b1])

        with Feature({"organizations:trace-items-consumer-model-creation": True}):
            process_batch(message)

        # set_project_flag_and_signal called once per project
        assert mock_set_project_flag_and_signal.call_count == 2
        mock_set_project_flag_and_signal.assert_has_calls(
            [
                mock.call(
                    self.project_a,
                    "has_transactions",
                    first_transaction_received,
                    event=mock.ANY,
                ),
                mock.call(
                    self.project_b,
                    "has_transactions",
                    first_transaction_received,
                    event=mock.ANY,
                ),
            ],
            any_order=True,
        )

        # record_generic_event_processed called once per segment
        assert mock_record_generic_event_processed.call_count == 3
        mock_record_generic_event_processed.assert_has_calls(
            [
                mock.call(self.project_a, platform="p", release="r", environment="e"),
                mock.call(self.project_a, platform="p", release="r", environment="e"),
                mock.call(self.project_b, platform="p", release="r", environment="e"),
            ],
            any_order=True,
        )

    @mock.patch("sentry.trace_items.consumers.process.message.set_project_flag_and_signal")
    @mock.patch("sentry.trace_items.consumers.process.message.record_generic_event_processed")
    def test_segment_signals_recorded_skips_non_segments(
        self, mock_record_generic_event_processed, mock_set_project_flag_and_signal
    ):
        child_span = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            environment="e",
            release="r",
            platform="p",
            # Only segments should be processed by `_record_signals`.
            is_segment=False,
        )
        message = _make_batch_message([child_span])

        with Feature({"organizations:trace-items-consumer-model-creation": True}):
            process_batch(message)

        mock_set_project_flag_and_signal.assert_not_called()
        mock_record_generic_event_processed.assert_not_called()

    @mock.patch("sentry.trace_items.consumers.process.message.set_project_flag_and_signal")
    def test_insights_modules_recorded(self, mock_set_project_flag_and_signal):
        http_span_1 = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            op="http.client",
            category="http",
        )
        http_span_2 = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            op="http.client",
            category="http",
        )
        db_span = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
            category="db",
            description="SELECT * FROM users",
        )
        other_span = _make_trace_item(
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            project_id=self.project_a.id,
            organization_id=self.organization.id,
        )
        message = _make_batch_message([http_span_1, http_span_2, db_span, other_span])

        with Feature({"organizations:trace-items-consumer-model-creation": True}):
            process_batch(message)

        # Called once per module (http, db).
        assert mock_set_project_flag_and_signal.call_count == 2
        flag_names = {call.args[1] for call in mock_set_project_flag_and_signal.call_args_list}
        assert flag_names == {"has_insights_http", "has_insights_db"}
