from __future__ import annotations

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import click
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models import ExpressionWrapper, F
from django.db.models.fields import DateTimeField

from sentry.new_migrations.migrations import CheckedMigration

BATCH_SIZE = 100_000
SENTINEL = datetime(1970, 1, 1, 0, 0, 0, tzinfo=dt_timezone.utc)
DEFAULT_RETENTION_DAYS = 30

DATE_EXPIRES_EXPR = ExpressionWrapper(
    F("date_added") + timedelta(days=DEFAULT_RETENTION_DAYS),
    output_field=DateTimeField(),
)


def backfill_eventattachment_date_expires(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    EventAttachment = apps.get_model("sentry", "EventAttachment")

    total_updated = 0
    last_id = 0
    batch_num = 0

    while True:
        # Index-only PK scan to find the upper boundary of the next batch.
        boundary_list = list(
            EventAttachment.objects.filter(id__gt=last_id)
            .order_by("id")
            .values_list("id", flat=True)[BATCH_SIZE - 1 : BATCH_SIZE]
        )

        if not boundary_list:
            # Fewer rows remain than BATCH_SIZE — update the tail and stop.
            updated = EventAttachment.objects.filter(id__gt=last_id, date_expires=SENTINEL).update(
                date_expires=DATE_EXPIRES_EXPR
            )
            total_updated += updated
            break

        boundary = boundary_list[0]
        updated = EventAttachment.objects.filter(
            id__gt=last_id, id__lte=boundary, date_expires=SENTINEL
        ).update(date_expires=DATE_EXPIRES_EXPR)

        total_updated += updated
        last_id = boundary
        batch_num += 1

        if batch_num % 10 == 0:
            click.echo(f"Backfilled {total_updated} rows so far...")

    click.echo(f"Done. Backfilled {total_updated} rows total.")


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("sentry", "1061_eventattachment_date_expires_index"),
    ]

    operations = [
        migrations.RunPython(
            backfill_eventattachment_date_expires,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_eventattachment"]},
        ),
    ]
