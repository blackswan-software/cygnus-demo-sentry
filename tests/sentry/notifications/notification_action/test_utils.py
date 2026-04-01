import uuid
from dataclasses import asdict
from unittest.mock import Mock, patch

from slack_sdk.web import SlackResponse

from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.activity import Activity
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.notification_action.utils import (
    send_metric_alert_via_notification_platform,
)
from sentry.notifications.platform.types import NotificationSource
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

pytestmark = [requires_snuba]

SLACK_CLIENT_PATH = "sentry.integrations.slack.integration.SlackSdkClient"
EVENTSTORE_PATH = (
    "sentry.notifications.platform.slack.renderers.metric_alert.eventstore.backend.get_event_by_id"
)
CHART_PATH = "sentry.notifications.platform.slack.renderers.metric_alert.build_metric_alert_chart"
INTERNAL_TESTING_OPTION = "notifications.platform-rollout.internal-testing"
INTERNAL_TESTING_FLAG = "organizations:notification-platform.internal-testing"
METRIC_ALERT_ROLLOUT = {
    INTERNAL_TESTING_OPTION: {"metric-alert": 1.0, "activity-metric-alert": 1.0}
}


class TestSendMetricAlertViaNotificationPlatform(MetricAlertHandlerBase):
    """
    Tests for send_metric_alert_via_notification_platform.
    Verifies the function correctly routes through the notification platform to the Slack client,
    and stores threading objects.
    """

    def setUp(self) -> None:
        self.create_models()
        self.integration, _ = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )
        self.action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_identifier": "C1234567890",
                "target_display": "#alerts",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

    def _make_invocation(self, event_data: WorkflowEventData | None = None) -> ActionInvocation:
        return ActionInvocation(
            event_data=event_data or self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )

    def _make_slack_response(self, ts: str) -> SlackResponse:
        mock_client = Mock()
        return SlackResponse(
            client=mock_client,
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={"ok": True, "ts": ts},
            headers={},
            status_code=200,
        )

    def _make_activity_event_data(self) -> WorkflowEventData:
        activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=asdict(self.evidence_data),
        )
        activity.save()
        return WorkflowEventData(
            event=activity,
            workflow_env=self.workflow.environment,
            group=self.group,
        )

    @with_feature(INTERNAL_TESTING_FLAG)
    @override_options(METRIC_ALERT_ROLLOUT)
    @patch(CHART_PATH, return_value=None)
    @patch(EVENTSTORE_PATH)
    @patch(SLACK_CLIENT_PATH)
    def test_group_event_sends_to_slack(
        self, mock_slack_client: Mock, mock_get_event: Mock, _mock_chart: Mock
    ) -> None:
        """GroupEvent (firing) path sends to the correct channel with a metric alert payload."""
        mock_get_event.return_value = self.group_event
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = self._make_slack_response(
            "1111.111111"
        )

        send_metric_alert_via_notification_platform(self._make_invocation())

        mock_client_instance.chat_postMessage.assert_called_once()
        call_kwargs = mock_client_instance.chat_postMessage.call_args[1]
        assert call_kwargs["channel"] == "C1234567890"
        assert call_kwargs["blocks"]
        assert call_kwargs["blocks"][0]["type"] == "section"
        assert self.detector.name in call_kwargs["text"]

    @with_feature(INTERNAL_TESTING_FLAG)
    @override_options(METRIC_ALERT_ROLLOUT)
    @patch(CHART_PATH, return_value=None)
    @patch(SLACK_CLIENT_PATH)
    def test_activity_sends_to_slack(self, mock_slack_client: Mock, _mock_chart: Mock) -> None:
        """Activity (resolution) path sends to the correct channel with a metric alert payload."""
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = self._make_slack_response(
            "1111.111111"
        )

        invocation = self._make_invocation(event_data=self._make_activity_event_data())
        send_metric_alert_via_notification_platform(invocation)

        mock_client_instance.chat_postMessage.assert_called_once()
        call_kwargs = mock_client_instance.chat_postMessage.call_args[1]
        assert call_kwargs["channel"] == "C1234567890"
        assert call_kwargs["blocks"]
        assert call_kwargs["blocks"][0]["type"] == "section"
        assert self.detector.name in call_kwargs["text"]

    def test_missing_integration_or_target_logs_warning(self) -> None:
        """When the action has no integration_id, logs a warning and returns early without sending."""
        action_no_integration = self.create_action(
            type=Action.Type.SLACK,
            integration_id=None,
            config={
                "target_identifier": "C1234567890",
                "target_display": "#alerts",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        invocation = ActionInvocation(
            event_data=self.event_data,
            action=action_no_integration,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
        )

        with self.assertLogs("sentry", level="WARNING") as captured:
            send_metric_alert_via_notification_platform(invocation)

        assert any("missing_integration_or_target" in line for line in captured.output)

    @with_feature(INTERNAL_TESTING_FLAG)
    @override_options(METRIC_ALERT_ROLLOUT)
    @patch(CHART_PATH, return_value=None)
    @patch(EVENTSTORE_PATH)
    @patch(SLACK_CLIENT_PATH)
    def test_firing_creates_notification_thread(
        self, mock_slack_client: Mock, mock_get_event: Mock, _mock_chart: Mock
    ) -> None:
        """Firing a metric alert stores a NotificationThread for subsequent replies."""
        mock_get_event.return_value = self.group_event
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = self._make_slack_response(
            "1111.111111"
        )

        assert NotificationThread.objects.count() == 0

        send_metric_alert_via_notification_platform(self._make_invocation())

        assert NotificationThread.objects.count() == 1
        thread = NotificationThread.objects.get()
        assert thread.thread_identifier == "1111.111111"
        assert thread.target_id == "C1234567890"
        assert thread.key_type == NotificationSource.METRIC_ALERT

    @with_feature(INTERNAL_TESTING_FLAG)
    @override_options(METRIC_ALERT_ROLLOUT)
    @patch(CHART_PATH, return_value=None)
    @patch(EVENTSTORE_PATH)
    @patch(SLACK_CLIENT_PATH)
    def test_resolution_replies_in_thread(
        self, mock_slack_client: Mock, mock_get_event: Mock, _mock_chart: Mock
    ) -> None:
        """Resolution uses the same thread key as the firing notification and replies in-thread."""
        mock_get_event.return_value = self.group_event
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = self._make_slack_response(
            "1111.111111"
        )

        # Fire the alert — creates the thread
        send_metric_alert_via_notification_platform(self._make_invocation())

        # Send the resolution — should reply into the same thread
        mock_client_instance.chat_postMessage.return_value = self._make_slack_response(
            "2222.222222"
        )
        resolution_invocation = self._make_invocation(event_data=self._make_activity_event_data())
        send_metric_alert_via_notification_platform(resolution_invocation)

        assert mock_client_instance.chat_postMessage.call_count == 2
        resolution_kwargs = mock_client_instance.chat_postMessage.call_args_list[1][1]
        assert resolution_kwargs["thread_ts"] == "1111.111111"
        assert resolution_kwargs["reply_broadcast"] is True
