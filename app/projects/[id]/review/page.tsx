import { redirect } from "next/navigation";

import { IdeaEditor } from "@/components/idea-editor";
import { GenerationProgress } from "@/components/generation-progress";
import { ReviewWorkspace } from "@/components/review-workspace";
import { getProjectStore } from "@/server/db/projects";
import { withOwnerDeclaration } from "@/server/documents/attribution";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getProjectStore();
  const project = store.getProject(id);
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
  const displayedRevisions = project.revisions.map((revision) =>
    revision.documentType === "specification"
      ? {
          ...revision,
          content: withOwnerDeclaration(revision.content, project.ownerName),
        }
      : revision,
  );
  const documentsAreCurrent = store.selectedDocumentsUseCurrentIdea(project.id);

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
        <a href={`/projects/${project.id}/history`}>Project history</a>
      </header>
      <IdeaEditor
        projectId={project.id}
        ideaName={project.title}
        idea={project.idea}
      />
      {!documentsAreCurrent ? (
        <GenerationProgress
          projectId={project.id}
          provider={project.provider}
          model={project.model}
          autoStart={false}
          onComplete="refresh"
        />
      ) : null}
      <ReviewWorkspace
        key={`${project.currentIdeaVersionId}:${documentsAreCurrent}`}
        projectId={id}
        revisions={displayedRevisions}
        initialSpecificationId={specification.id}
        initialNdaId={nda.id}
        currentIdeaVersionId={project.currentIdeaVersionId}
      />
    </div>
  );
}
