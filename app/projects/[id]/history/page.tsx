import Link from "next/link";

import { DocumentPreview } from "@/components/document-preview";
import { getProjectStore } from "@/server/db/projects";
import { withOwnerDeclaration } from "@/server/documents/attribution";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getProjectStore();
  const project = store.getProject(id);
  const ideaVersions = [...store.getIdeaVersions(id)].reverse();
  const revisions = [...project.revisions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="content-shell">
      <div className="page-heading heading-row">
        <div>
          <h1>Project history</h1>
          <p>
            {project.title}. Idea updates and generated documents remain
            available for inspection.
          </p>
          <p className="model-metadata">
            {project.provider === "openai" ? "OpenAI" : "Claude"} ·{" "}
            {project.model}
          </p>
        </div>
        <Link className="button button-secondary" href={`/projects/${id}/review`}>
          Back to review
        </Link>
      </div>
      <section className="history-section idea-history">
        <h2>Idea history</h2>
        <p className="field-help">
          These are local history dates, not OpenTimestamps proofs.
        </p>
        <div className="history-list">
          {ideaVersions.map((version) => (
            <details key={version.id}>
              <summary>
                <span>
                  {version.version === 1 ? "Idea created" : "Idea updated"}
                </span>
                <time dateTime={version.createdAt}>
                  {new Date(version.createdAt).toLocaleString()}
                </time>
              </summary>
              <h3>{version.ideaName}</h3>
              <p>{version.idea}</p>
              {version.updateNote ? (
                <p>Update note: {version.updateNote}</p>
              ) : null}
            </details>
          ))}
        </div>
      </section>
      <section className="history-section">
        <h2>Document history</h2>
        <div className="history-list">
        {revisions.map((revision) => (
          <details key={revision.id}>
            <summary>
              <span>
                {revision.documentType === "nda" ? "Sample NDA" : "Specification"}{" "}
                · Version {revision.version}
              </span>
              <span>{revision.wordCount} words</span>
            </summary>
            <dl className="revision-meta">
              <div>
                <dt>Created</dt>
                <dd>{new Date(revision.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Provider and model</dt>
                <dd>
                  {revision.provider === "openai" ? "OpenAI" : "Claude"} ·{" "}
                  {revision.model}
                </dd>
              </div>
              <div>
                <dt>Prompt</dt>
                <dd>{revision.promptTemplateVersion}</dd>
              </div>
              <div>
                <dt>Feedback</dt>
                <dd>{revision.feedback ?? "Initial generation"}</dd>
              </div>
            </dl>
            <DocumentPreview
              markdown={
                revision.documentType === "specification"
                  ? withOwnerDeclaration(
                      revision.content,
                      project.ownerName,
                    )
                  : revision.content
              }
            />
          </details>
        ))}
        </div>
      </section>
    </div>
  );
}
