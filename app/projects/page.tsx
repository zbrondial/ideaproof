import Link from "next/link";

import { ProjectList } from "@/components/project-list";
import { getProjectStore, type ProjectStatus } from "@/server/db/projects";

const validStatuses = new Set<ProjectStatus>([
  "draft",
  "generating",
  "review",
  "pending",
  "confirmed",
  "failed",
]);

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const query = await searchParams;
  const status =
    query.status && validStatuses.has(query.status as ProjectStatus)
      ? (query.status as ProjectStatus)
      : undefined;
  const projects = getProjectStore().listProjects({
    search: query.search,
    status,
  });

  return (
    <div className="content-shell">
      <div className="page-heading heading-row">
        <div>
          <h1>Proof Logs</h1>
          <p>Your ideas, generated documents, and proof status.</p>
        </div>
        <Link className="button" href="/projects/new">
          Timestamp a new idea
        </Link>
      </div>
      <form className="filter-bar" action="/projects">
        <label>
          <span className="sr-only">Search projects</span>
          <input
            name="search"
            type="search"
            defaultValue={query.search}
            placeholder="Search projects"
          />
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending">Proof pending</option>
            <option value="confirmed">Timestamp complete</option>
            <option value="failed">Needs attention</option>
          </select>
        </label>
        <button className="button button-secondary button-small" type="submit">
          Filter
        </button>
      </form>
      <ProjectList projects={projects} />
    </div>
  );
}
