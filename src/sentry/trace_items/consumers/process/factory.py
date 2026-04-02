from collections.abc import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import (
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.processing.strategies.batching import BatchStep
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.filter import FilterStep
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, FilteredPayload, Partition

from sentry.trace_items.consumers.process.message import (
    filter_message,
    process_batch,
)


class SnubaItemModelCreationStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """A consumer that creates Sentry models and handles related signals for
    incoming EAP trace items."""

    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        **kwargs: object,
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[FilteredPayload | KafkaPayload]:
        run_task = RunTask(
            function=process_batch,
            next_step=CommitOffsets(commit),
        )

        batch_step = BatchStep(
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            next_step=run_task,
        )

        filter_step = FilterStep(function=filter_message, next_step=batch_step)

        return filter_step
