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
          <p className="section-label">Proof logs</p>
          <h1>Your idea projects</h1>
          <p>Review drafts, pending timestamps, and confirmed proof packages.</p>
        </div>
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
            <option value="confirmed">Confirmed</option>
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
