import { redirect } from "next/navigation";

import { ReviewWorkspace } from "@/components/review-workspace";
import { getProjectStore } from "@/server/db/projects";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProjectStore().getProject(id);
  if (project.approval) {
    redirect(`/projects/${id}/proof`);
  }
  const specification =
    project.revisions.find(
      (item) => item.id === project.selectedSpecificationRevisionId,
    ) ??
    project.revisions
      .filter((item) => item.documentType === "specification")
      .at(-1);
  const nda =
    project.revisions.find((item) => item.id === project.selectedNdaRevisionId) ??
    project.revisions.filter((item) => item.documentType === "nda").at(-1);

  if (!specification || !nda) {
    return (
      <div className="content-shell narrow-shell">
        <div className="empty-state">
          <h1>Both documents are not ready yet.</h1>
          <p>Return to generation and retry the missing document.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-shell">
      <header className="page-heading review-heading">
        <div>
          <h1>Review your documents</h1>
          <p className="project-context">{project.title}</p>
          <p className="model-metadata">
            {project.provider === "openai" ? "OpenAI" : "Claude"} ·{" "}
            {project.model}
          </p>
        </div>
        <a href={`/projects/${project.id}/history`}>Revision history</a>
      </header>
      <ReviewWorkspace
        projectId={id}
        revisions={project.revisions}
        initialSpecificationId={specification.id}
        initialNdaId={nda.id}
      />
    </div>
  );
}
