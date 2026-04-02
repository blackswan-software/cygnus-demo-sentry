from unittest import mock

from django.core.exceptions import ValidationError

from sentry.models.distribution import Distribution
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.trace_items.create_models import create_environment_and_release_models


class TestCreateEnvironmentAndReleaseModels(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project(organization=self.organization)
        self.date = before_now(minutes=5)

    def test_creates_all_models(self):
        create_environment_and_release_models(
            project=self.project,
            environment_name="production",
            release_name="1.0.0",
            dist_name="x86",
            date=self.date,
        )

        env = Environment.objects.get(
            organization_id=self.project.organization_id, name="production"
        )
        release = Release.objects.get(organization_id=self.project.organization_id, version="1.0.0")
        assert Distribution.objects.filter(release=release, name="x86").exists()
        assert ReleaseEnvironment.objects.filter(
            release_id=release.id, environment_id=env.id
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            release_id=release.id, environment_id=env.id, project_id=self.project.id
        ).exists()

    def test_no_release_name_returns_early(self):
        create_environment_and_release_models(
            project=self.project,
            environment_name="production",
            release_name=None,
            dist_name="x86",
            date=self.date,
        )

        assert Environment.objects.filter(
            organization_id=self.project.organization_id, name="production"
        ).exists()
        assert not Release.objects.filter(organization_id=self.project.organization_id).exists()

    def test_no_date_returns_early(self):
        create_environment_and_release_models(
            project=self.project,
            environment_name="production",
            release_name="1.0.0",
            dist_name="x86",
            date=None,
        )

        assert Environment.objects.filter(
            organization_id=self.project.organization_id, name="production"
        ).exists()
        assert not Release.objects.filter(organization_id=self.project.organization_id).exists()

    def test_no_dist_name_skips_dist(self):
        create_environment_and_release_models(
            project=self.project,
            environment_name="production",
            release_name="1.0.0",
            dist_name=None,
            date=self.date,
        )

        release = Release.objects.get(organization_id=self.project.organization_id, version="1.0.0")
        assert not Distribution.objects.filter(release=release).exists()
        assert ReleaseEnvironment.objects.filter(release_id=release.id).exists()
        assert ReleaseProjectEnvironment.objects.filter(release_id=release.id).exists()

    @mock.patch("sentry.trace_items.create_models.Release.get_or_create")
    def test_validation_error_returns_early(self, mock_get_or_create):
        mock_get_or_create.side_effect = ValidationError("bad version")

        create_environment_and_release_models(
            project=self.project,
            environment_name="production",
            release_name="bad-version",
            dist_name="x86",
            date=self.date,
        )

        assert Environment.objects.filter(
            organization_id=self.project.organization_id, name="production"
        ).exists()
        assert not ReleaseEnvironment.objects.filter(project_id=self.project.id).exists()
        assert not ReleaseProjectEnvironment.objects.filter(project_id=self.project.id).exists()

    def test_none_environment_name(self):
        create_environment_and_release_models(
            project=self.project,
            environment_name=None,
            release_name="1.0.0",
            dist_name=None,
            date=self.date,
        )

        env = Environment.objects.get(organization_id=self.project.organization_id, name="")
        release = Release.objects.get(organization_id=self.project.organization_id, version="1.0.0")
        assert ReleaseEnvironment.objects.filter(
            release_id=release.id, environment_id=env.id
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            release_id=release.id, environment_id=env.id, project_id=self.project.id
        ).exists()

    @mock.patch("sentry.trace_items.create_models.record_latest_release")
    def test_record_latest_release_called_with_environment_name(self, mock_record):
        create_environment_and_release_models(
            project=self.project,
            environment_name="production",
            release_name="1.0.0",
            dist_name=None,
            date=self.date,
        )

        release = Release.objects.get(organization_id=self.project.organization_id, version="1.0.0")
        mock_record.assert_called_once_with(self.project, release, "production")

    @mock.patch("sentry.trace_items.create_models.record_release_received")
    def test_record_release_received_called_with_version(self, mock_record):
        create_environment_and_release_models(
            project=self.project,
            environment_name="production",
            release_name="1.0.0",
            dist_name=None,
            date=self.date,
        )

        mock_record.assert_called_once_with(self.project, "1.0.0")
        mock_record.assert_called_once_with(self.project, "1.0.0")
