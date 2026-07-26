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
          <p className="section-label">Revision history</p>
          <h1>{project.title}</h1>
          <p>Every accepted generation remains available for inspection.</p>
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
                <dt>Model</dt>
                <dd>{revision.model}</dd>
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
