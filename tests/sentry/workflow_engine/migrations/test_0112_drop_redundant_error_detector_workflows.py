from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import DetectorWorkflow


class DropRedundantErrorDetectorWorkflowsTest(TestMigrations):
    migrate_from = "0111_add_workflowfirehistory_date_added_index"
    migrate_to = "0112_drop_redundant_error_detector_workflows"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")
        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

        # === Scenario 1: Should DELETE ===
        # Error detector workflow with matching issue_stream workflow on same workflow
        self.error_detector_1 = self.create_detector(project=self.project1, type="error")
        self.issue_stream_detector_1 = self.create_detector(
            project=self.project1, type="issue_stream"
        )
        self.workflow_1 = self.create_workflow(organization=self.org)
        self.dw_error_should_delete = self.create_detector_workflow(
            detector=self.error_detector_1, workflow=self.workflow_1
        )
        self.dw_issue_stream_keep = self.create_detector_workflow(
            detector=self.issue_stream_detector_1, workflow=self.workflow_1
        )

        # === Scenario 2: Should NOT DELETE ===
        # Error detector with no matching issue_stream on same workflow
        self.error_detector_2 = self.create_detector(project=self.project1, type="error")
        self.workflow_2 = self.create_workflow(organization=self.org)
        self.dw_error_no_match = self.create_detector_workflow(
            detector=self.error_detector_2, workflow=self.workflow_2
        )

        # === Scenario 3: Issue_stream detector only ===
        self.issue_stream_detector_2 = self.create_detector(
            project=self.project1, type="issue_stream"
        )
        self.workflow_3 = self.create_workflow(organization=self.org)
        self.dw_issue_stream_only = self.create_detector_workflow(
            detector=self.issue_stream_detector_2, workflow=self.workflow_3
        )

        # === Scenario 4: Cross-project isolation ===
        # Project 2 has error detector only (no issue_stream)
        self.error_detector_p2 = self.create_detector(project=self.project2, type="error")
        self.workflow_p2 = self.create_workflow(organization=self.org)
        self.dw_error_project2 = self.create_detector_workflow(
            detector=self.error_detector_p2, workflow=self.workflow_p2
        )

    def test_deletes_error_workflow_with_matching_issue_stream(self) -> None:
        assert not DetectorWorkflow.objects.filter(id=self.dw_error_should_delete.id).exists()

    def test_preserves_issue_stream_workflow_when_error_deleted(self) -> None:
        assert DetectorWorkflow.objects.filter(id=self.dw_issue_stream_keep.id).exists()

    def test_preserves_error_workflow_without_matching_issue_stream(self) -> None:
        assert DetectorWorkflow.objects.filter(id=self.dw_error_no_match.id).exists()

    def test_preserves_issue_stream_only_workflow(self) -> None:
        assert DetectorWorkflow.objects.filter(id=self.dw_issue_stream_only.id).exists()

    def test_preserves_cross_project_error_workflow_without_issue_stream(self) -> None:
        assert DetectorWorkflow.objects.filter(id=self.dw_error_project2.id).exists()

    def test_total_count_after_migration(self) -> None:
        assert DetectorWorkflow.objects.count() == 4
