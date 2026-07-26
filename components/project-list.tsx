import Link from "next/link";

import type { ProjectSummary } from "@/server/db/projects";

import { StatusBadge } from "./status-badge";

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <h2>No projects found</h2>
        <p>Create an idea project or adjust the current filters.</p>
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
          <StatusBadge status={project.status} />
        </Link>
      ))}
    </div>
  );
}
