import logging

from sentry.eventstore.models import GroupEvent
from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.notifications.notification_action.registry import (
    group_type_notification_registry,
    issue_alert_handler_registry,
    metric_alert_handler_registry,
)
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.templates.issue import (
    IssueNotificationData,
    SerializableRuleProxy,
)
from sentry.notifications.platform.templates.metric_alert import (
    ActivityMetricAlertNotificationData,
    MetricAlertNotificationData,
    SerializableAlertContext,
)
from sentry.notifications.platform.threading import ThreadingOptions, ThreadKey
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


def should_fire_workflow_actions(org: Organization, type_id: int) -> bool:
    return True


def execute_via_group_type_registry(invocation: ActionInvocation) -> None:
    """
    Generic "notification action handler" this method will lookup which registry
    to send the notification to, based on the type of detector that created it.

    This currently only supports the following detector types: 'error', 'metric_issue'

    If an `Activity` model for a `Group` is provided in the event data
    it will send an activity notification instead.
    """
    if isinstance(invocation.event_data.event, Activity):
        # TODO - this is a workaround to ensure a notification is sent about the issue.
        # We'll need to update this in the future to read the notification configuration
        # from the Action, then get the template for the activity, and send it to that
        # integration.
        # If it is a metric issue resolution, we need to execute the metric alert handler
        # Else we can use the activity.send_notification() method to send the notification.
        if (
            invocation.event_data.event.type in BaseMetricAlertHandler.ACTIVITIES_TO_INVOKE_ON
            and invocation.event_data.group.type == MetricIssue.type_id
        ):
            return execute_via_metric_alert_handler(invocation)
        return invocation.event_data.event.send_notification()

    try:
        handler = group_type_notification_registry.get(invocation.detector.type)
        handler.handle_workflow_action(invocation)
    except NoRegistrationExistsError:
        # If the grouptype is not registered, we can just use the issue alert handler
        # This is so that notifications will still be sent for that group type if we forget to register a handler
        # Most grouptypes are sent to issue alert handlers
        logger.warning(
            "group_type_notification_registry.get.NoRegistrationExistsError",
            extra={"detector_id": invocation.detector.id, "action_id": invocation.action.id},
        )
        return execute_via_issue_alert_handler(invocation)
    except Exception:
        logger.exception(
            "Error executing via group type registry",
            extra={"detector_id": invocation.detector.id, "action_id": invocation.action.id},
        )
        raise


def execute_via_issue_alert_handler(invocation: ActionInvocation) -> None:
    """
    This exists so that all ticketing actions can use the same handler as issue alerts since that's the only way we can
    ensure that the same thread is used for the notification action.
    """
    try:
        handler = issue_alert_handler_registry.get(invocation.action.type)
        handler.invoke_legacy_registry(invocation)
    except NoRegistrationExistsError:
        logger.exception(
            "No notification handler found for action type: %s",
            invocation.action.type,
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        raise
    except Exception:
        logger.exception(
            "Error executing via issue alert handler",
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        raise


def send_metric_alert_via_notification_platform(invocation: ActionInvocation) -> None:
    notification_context = BaseMetricAlertHandler.build_notification_context(invocation.action)

    if (
        notification_context.integration_id is None
        or notification_context.target_identifier is None
    ):
        logger.warning(
            "notification_action.metric_alert.notification_platform.missing_integration_or_target",
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        return

    event = invocation.event_data.event
    organization = invocation.detector.project.organization

    if isinstance(event, GroupEvent):
        evidence_data, priority = BaseMetricAlertHandler._extract_from_group_event(event)
    elif isinstance(event, Activity):
        evidence_data, priority = BaseMetricAlertHandler._extract_from_activity(event)
    else:
        raise ValueError(
            "WorkflowEventData.event must be a GroupEvent or Activity to invoke metric alert notification platform"
        )

    alert_context = BaseMetricAlertHandler.build_alert_context(
        invocation.detector, evidence_data, invocation.event_data.group.status, priority
    )
    open_period_context = BaseMetricAlertHandler.build_open_period_context(
        invocation.event_data.group
    )
    serializable_alert_context = SerializableAlertContext.from_alert_context(alert_context)

    data: ActivityMetricAlertNotificationData | MetricAlertNotificationData
    if isinstance(event, Activity):
        data = ActivityMetricAlertNotificationData(
            activity_id=event.id,
            group_id=invocation.event_data.group.id,
            organization_id=organization.id,
            detector_id=invocation.detector.id,
            alert_context=serializable_alert_context,
            open_period_context=open_period_context,
            notification_uuid=invocation.notification_uuid,
        )
    else:
        data = MetricAlertNotificationData(
            event_id=event.event_id,
            project_id=invocation.detector.project.id,
            group_id=invocation.event_data.group.id,
            organization_id=organization.id,
            detector_id=invocation.detector.id,
            alert_context=serializable_alert_context,
            open_period_context=open_period_context,
            notification_uuid=invocation.notification_uuid,
        )

    target = IntegrationNotificationTarget(
        provider_key=NotificationProviderKey.SLACK,
        resource_type=NotificationTargetResourceType.CHANNEL,
        resource_id=notification_context.target_identifier,
        integration_id=notification_context.integration_id,
        organization_id=organization.id,
    )

    thread_key = ThreadKey(
        key_type=NotificationSource.METRIC_ALERT,
        key_data={
            "action_id": invocation.action.id,
            "group_id": invocation.event_data.group.id,
            "open_period_id": open_period_context.id,
        },
    )
    # Resolutions reply into the original alert thread and broadcast to the channel.
    threading_options = ThreadingOptions(
        thread_key=thread_key,
        reply_broadcast=isinstance(event, Activity),
    )

    NotificationService(data=data).notify_sync(
        targets=[target], threading_options=threading_options
    )


def execute_via_metric_alert_handler(invocation: ActionInvocation) -> None:
    """
    This exists so that all metric alert resolution actions can use the same handler as metric alerts
    """
    if invocation.action.type == Action.Type.SLACK:
        organization = invocation.detector.project.organization
        source = (
            NotificationSource.ACTIVITY_METRIC_ALERT
            if isinstance(invocation.event_data.event, Activity)
            else NotificationSource.METRIC_ALERT
        )
        if NotificationService.has_access(organization, source):
            send_metric_alert_via_notification_platform(invocation)
            return

    try:
        handler = metric_alert_handler_registry.get(invocation.action.type)
        handler.invoke_legacy_registry(invocation)
    except NoRegistrationExistsError:
        logger.exception(
            "No notification handler found for action type: %s",
            invocation.action.type,
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        raise
    except Exception:
        logger.exception(
            "Error executing via metric alert handler in legacy registry",
            extra={"action_id": invocation.action.id, "detector_id": invocation.detector.id},
        )
        raise


def issue_notification_data_factory(invocation: ActionInvocation) -> IssueNotificationData:
    from sentry.notifications.notification_action.types import BaseIssueAlertHandler

    action = invocation.action
    detector = invocation.detector
    event_data = invocation.event_data

    rule_instance = BaseIssueAlertHandler.create_rule_instance_from_action(
        action=action,
        detector=detector,
        event_data=event_data,
    )
    rule_instance.data["tags"] = action.data.get("tags", "")
    rule_instance.data["notes"] = action.data.get("notes", "")
    rule = SerializableRuleProxy.from_rule(rule_instance)

    event_id = getattr(event_data.event, "event_id", None) if event_data.event else None

    return IssueNotificationData(
        event_id=event_id,
        group_id=event_data.group.id,
        notification_uuid=invocation.notification_uuid,
        rule=rule,
    )
