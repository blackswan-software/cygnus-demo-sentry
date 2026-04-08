from unittest.mock import patch

from django.utils import timezone

from sentry.models.group import GroupStatus
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.seer.night_shift import (
    _fixability_score_strategy,
    _get_eligible_projects,
    run_night_shift_for_org,
    schedule_night_shift,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestScheduleNightShift(TestCase):
    def test_disabled_by_option(self) -> None:
        with (
            self.options({"seer.night_shift.enable": False}),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_dispatches_eligible_orgs(self) -> None:
        org = self.create_organization()

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_called_once()
            assert mock_worker.apply_async.call_args.kwargs["args"] == [org.id]

    def test_skips_ineligible_orgs(self) -> None:
        self.create_organization()

        with (
            self.options({"seer.night_shift.enable": True}),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_skips_orgs_with_hidden_ai(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:hide_ai_features", True)

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()


@django_db_all
class TestGetEligibleProjects(TestCase):
    def _connect_repo(self, project):
        repo = self.create_repo(project=project, provider="github")
        SeerProjectRepository.objects.create(project=project, repository=repo)

    def test_skips_projects_with_automation_off(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF
        )
        self._connect_repo(project)

        assert _get_eligible_projects(org) == []

    def test_skips_projects_without_connected_repos(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        assert _get_eligible_projects(org) == []

    def test_returns_eligible_projects(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        self._connect_repo(project)

        assert _get_eligible_projects(org) == [project]


@django_db_all
class TestRunNightShiftForOrg(TestCase):
    def test_nonexistent_org(self) -> None:
        with patch("sentry.tasks.seer.night_shift.logger") as mock_logger:
            run_night_shift_for_org(999999999)
            mock_logger.info.assert_not_called()

    def test_no_eligible_projects(self) -> None:
        org = self.create_organization()

        with (
            patch("sentry.tasks.seer.night_shift._get_eligible_projects", return_value=[]),
            patch("sentry.tasks.seer.night_shift.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)
            mock_logger.info.assert_called_once()
            assert mock_logger.info.call_args.args[0] == "night_shift.no_eligible_projects"

    def test_selects_candidates_by_fixability(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )

        # Create issues with different fixability scores
        high_fix = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.9,
            times_seen=5,
        )
        low_fix = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.2,
            times_seen=100,
        )

        with (
            patch(
                "sentry.tasks.seer.night_shift._get_eligible_projects",
                return_value=[project],
            ),
            patch("sentry.tasks.seer.night_shift.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)

            call_extra = mock_logger.info.call_args.kwargs["extra"]
            assert call_extra["num_candidates"] == 2
            candidates = call_extra["candidates"]
            # Higher fixability should rank first
            assert candidates[0]["group_id"] == high_fix.id
            assert candidates[1]["group_id"] == low_fix.id

    def test_skips_already_triggered_issues(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)

        self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.9,
            seer_autofix_last_triggered=timezone.now(),
        )
        untriggered = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.5,
        )

        with (
            patch(
                "sentry.tasks.seer.night_shift._get_eligible_projects",
                return_value=[project],
            ),
            patch("sentry.tasks.seer.night_shift.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)

            call_extra = mock_logger.info.call_args.kwargs["extra"]
            assert call_extra["num_candidates"] == 1
            assert call_extra["candidates"][0]["group_id"] == untriggered.id

    def test_global_ranking_across_projects(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)

        low_group = self.create_group(
            project=project_a,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.3,
        )
        high_group = self.create_group(
            project=project_b,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.95,
        )

        with (
            patch(
                "sentry.tasks.seer.night_shift._get_eligible_projects",
                return_value=[project_a, project_b],
            ),
            patch("sentry.tasks.seer.night_shift.logger") as mock_logger,
        ):
            run_night_shift_for_org(org.id)

            candidates = mock_logger.info.call_args.kwargs["extra"]["candidates"]
            assert candidates[0]["group_id"] == high_group.id
            assert candidates[0]["project_id"] == project_b.id
            assert candidates[1]["group_id"] == low_group.id
            assert candidates[1]["project_id"] == project_a.id


@django_db_all
class TestFixabilityScoreStrategy(TestCase):
    def test_ranks_by_fixability(self) -> None:
        project = self.create_project()
        high = self.create_group(
            project=project, status=GroupStatus.UNRESOLVED, seer_fixability_score=0.9, times_seen=1
        )
        low = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.2,
            times_seen=500,
        )

        result = _fixability_score_strategy([project])

        assert result[0].group_id == high.id
        assert result[1].group_id == low.id

    def test_captures_raw_signals(self) -> None:
        project = self.create_project()
        self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=0.7,
            times_seen=100,
            priority=75,
        )

        result = _fixability_score_strategy([project])

        assert len(result) == 1
        assert result[0].fixability == 0.7
        assert result[0].times_seen == 100
        assert result[0].severity == 1.0

    def test_includes_issues_without_fixability_score(self) -> None:
        project = self.create_project()
        self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            seer_fixability_score=None,
            times_seen=50,
        )

        result = _fixability_score_strategy([project])

        assert len(result) == 1
        assert result[0].fixability == 0.0
        assert result[0].times_seen == 50
