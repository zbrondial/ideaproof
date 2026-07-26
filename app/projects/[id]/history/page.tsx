import Link from "next/link";

import { DocumentPreview } from "@/components/document-preview";
import { getProjectStore } from "@/server/db/projects";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProjectStore().getProject(id);
  const revisions = [...project.revisions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="content-shell">
      <div className="page-heading heading-row">
        <div>
          <h1>Revision history</h1>
          <p>
            {project.title}. Every accepted generation remains available for
            inspection.
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
      <div className="history-list">
        {revisions.map((revision) => (
          <details key={revision.id}>
            <summary>
              <span>
                {revision.documentType === "nda" ? "Mutual NDA" : "Specification"}{" "}
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
            <DocumentPreview markdown={revision.content} />
          </details>
        ))}
      </div>
    </div>
  );
}
