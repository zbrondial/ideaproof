import type { ProjectStatus } from "@/server/db/projects";

const labels: Record<ProjectStatus, string> = {
  draft: "Draft",
  generating: "Generating",
  review: "In review",
  pending: "Proof pending",
  confirmed: "Timestamp complete",
  failed: "Needs attention",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="status-badge" data-status={status}>
      <span aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
