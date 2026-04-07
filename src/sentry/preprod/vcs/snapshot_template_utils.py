from __future__ import annotations

from django.utils.translation import gettext_lazy as _

from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.url_utils import get_preprod_artifact_comparison_url, get_preprod_artifact_url


def get_app_display_info(artifact: PreprodArtifact) -> tuple[str, str]:
    """Extract app display name and app ID from artifact."""
    mobile_app_info = getattr(artifact, "mobile_app_info", None)
    app_name = mobile_app_info.app_name if mobile_app_info else None
    app_display = app_name or artifact.app_id or str(_("Unknown App"))
    app_id = artifact.app_id or ""
    return app_display, app_id


def format_name_cell(app_display: str, app_id: str, url: str) -> str:
    """Format the name cell with app display name, app ID, and URL."""
    if app_id:
        return f"[{app_display}]({url})<br>`{app_id}`"
    return f"[{app_display}]({url})"


def get_artifact_url(
    artifact: PreprodArtifact,
    base_artifact: PreprodArtifact | None,
    metrics: PreprodSnapshotMetrics | None,
) -> str:
    """Get the appropriate URL for an artifact (comparison or standalone)."""
    if base_artifact and metrics:
        return get_preprod_artifact_comparison_url(
            artifact, base_artifact, comparison_type="snapshots"
        )
    return get_preprod_artifact_url(artifact, view_type="snapshots")


def format_section_cell(count: int, section: str, artifact_url: str) -> str:
    """Format a section cell with count and optional link."""
    if count > 0:
        return f"[{count}]({artifact_url}?section={section})"
    return str(count)


def get_comparison_status(
    artifact_id: int,
    changes_map: dict[int, bool],
    approvals_map: dict[int, PreprodComparisonApproval] | None = None,
) -> str:
    """Determine the status string for a comparison."""
    has_changes = changes_map.get(artifact_id, False)
    is_approved = approvals_map is not None and artifact_id in approvals_map
    if has_changes and is_approved:
        return "\u2705 Approved"
    elif has_changes:
        return "\u23f3 Needs approval"
    else:
        return "\u2705 Unchanged"
