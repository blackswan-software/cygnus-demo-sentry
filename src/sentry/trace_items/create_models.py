import logging
from datetime import datetime

from django.core.exceptions import ValidationError

from sentry.dynamic_sampling.rules.helpers.latest_releases import record_latest_release
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.receivers.onboarding import record_release_received

logger = logging.getLogger(__name__)


def create_environment_and_release_models(
    project: Project,
    environment_name: str | None,
    release_name: str | None,
    dist_name: str | None,
    date: datetime | None,
) -> None:
    """
    Ensure Environment, Release, and their join models exist for an incoming
    trace item. Also records dynamic-sampling and onboarding signals for the
    release.
    """
    environment = Environment.get_or_create(project=project, name=environment_name)

    if not release_name or not date:
        return

    try:
        release = Release.get_or_create(project=project, version=release_name, date_added=date)
    except ValidationError:
        # Avoid catching a stacktrace here, the codepath is very hot
        logger.warning(
            "Failed creating Release due to ValidationError",
            extra={"project": project, "version": release_name},
        )
        return

    if dist_name:
        release.add_dist(dist_name)

    ReleaseEnvironment.get_or_create(
        project=project, release=release, environment=environment, datetime=date
    )

    ReleaseProjectEnvironment.get_or_create(
        project=project, release=release, environment=environment, datetime=date
    )

    # Record the release for dynamic sampling
    record_latest_release(project, release, environment_name)

    # Record onboarding signals
    record_release_received(project, release.version)
