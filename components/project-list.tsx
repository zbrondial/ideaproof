import Link from "next/link";

import type { ProjectSummary } from "@/server/db/projects";

import { StatusBadge } from "./status-badge";

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <h2>No proof logs yet</h2>
        <p>
          Protect an idea to create your first document and proof record, or
          adjust the current filters.
        </p>
        <Link className="button button-secondary" href="/projects/new">
          Protect an idea
        </Link>
      </div>
    );
  }

  return (
    <div className="project-list">
      {projects.map((project) => (
        <Link className="project-row" href={`/projects/${project.id}`} key={project.id}>
          <div>
            <h2>{project.title}</h2>
            <time dateTime={project.createdAt}>
              Created{" "}
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(project.createdAt))}
            </time>
          </div>
          <div className="project-row-actions">
            <StatusBadge status={project.status} />
            <span className="row-open" aria-hidden="true">
              Open →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
