from __future__ import annotations

from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.vcs.snapshot_template_utils import (
    format_name_cell,
    format_section_cell,
    get_app_display_info,
    get_artifact_url,
    get_comparison_status,
)

_HEADER = "## Sentry Snapshot Testing"
_PROCESSING_STATUS = "\u23f3 Processing"


def format_snapshot_pr_comment(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    base_artifact_map: dict[int, PreprodArtifact],
    changes_map: dict[int, bool],
    approvals_map: dict[int, PreprodComparisonApproval] | None = None,
) -> str:
    """Format a PR comment for snapshot comparisons."""
    if not artifacts:
        raise ValueError("Cannot format PR comment for empty artifact list")

    table_rows = []

    for artifact in artifacts:
        name_cell = _name_cell(artifact, snapshot_metrics_map, base_artifact_map)
        metrics = snapshot_metrics_map.get(artifact.id)

        if not metrics:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {_PROCESSING_STATUS} |")
            continue

        comparison = comparisons_map.get(metrics.id)
        has_base = artifact.id in base_artifact_map

        if not comparison and not has_base:
            # No base to compare against — show snapshot count only
            table_rows.append(
                f"| {name_cell} | - | - | - | - | - | \u2705 {metrics.image_count} uploaded |"
            )
            continue

        if not comparison:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {_PROCESSING_STATUS} |")
            continue

        if comparison.state in (
            PreprodSnapshotComparison.State.PENDING,
            PreprodSnapshotComparison.State.PROCESSING,
        ):
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {_PROCESSING_STATUS} |")
        elif comparison.state == PreprodSnapshotComparison.State.FAILED:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | \u274c Comparison failed |")
        else:
            base_artifact = base_artifact_map.get(artifact.id)
            metrics = snapshot_metrics_map.get(artifact.id)
            artifact_url = get_artifact_url(artifact, base_artifact, metrics)
            status = get_comparison_status(artifact.id, changes_map, approvals_map)

            table_rows.append(
                f"| {name_cell}"
                f" | {format_section_cell(comparison.images_added, 'added', artifact_url)}"
                f" | {format_section_cell(comparison.images_removed, 'removed', artifact_url)}"
                f" | {format_section_cell(comparison.images_changed, 'changed', artifact_url)}"
                f" | {format_section_cell(comparison.images_renamed, 'renamed', artifact_url)}"
                f" | {format_section_cell(comparison.images_unchanged, 'unchanged', artifact_url)}"
                f" | {status} |"
            )

    table_header = (
        "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |\n"
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
    )

    return f"{_HEADER}\n\n{table_header}" + "\n".join(table_rows)


def _name_cell(
    artifact: PreprodArtifact,
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    base_artifact_map: dict[int, PreprodArtifact],
) -> str:
    app_display, app_id = get_app_display_info(artifact)
    metrics = snapshot_metrics_map.get(artifact.id)
    base_artifact = base_artifact_map.get(artifact.id)
    artifact_url = get_artifact_url(artifact, base_artifact, metrics)
    return format_name_cell(app_display, app_id, artifact_url)
