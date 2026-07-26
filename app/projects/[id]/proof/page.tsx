import Link from "next/link";

import { DocumentPreview } from "@/components/document-preview";
import { ProofStatus } from "@/components/proof-status";
import { StatusBadge } from "@/components/status-badge";
import { getProjectStore } from "@/server/db/projects";

export const dynamic = "force-dynamic";

const documentLabels = {
  specification: "Technical specification",
  nda: "Mutual NDA",
};

export default async function ProofPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProjectStore().getProject(id);
  if (!project.approval) {
    return (
      <div className="content-shell narrow-shell">
        <div className="empty-state">
          <h1>No proof has been created yet.</h1>
          <Link className="button" href={`/projects/${id}/review`}>
            Return to review
          </Link>
        </div>
      </div>
    );
  }

  const revisions = [
    project.revisions.find(
      (revision) =>
        revision.id === project.approval!.specificationRevisionId,
    ),
    project.revisions.find(
      (revision) => revision.id === project.approval!.ndaRevisionId,
    ),
  ].filter((revision) => revision !== undefined);

  return (
    <div className="content-shell">
      <div className="proof-heading">
        <div className="page-heading">
          <p className="section-label">Proof record</p>
          <h1>{project.title}</h1>
          <p>
            IdeaProof created a digital fingerprint of each approved PDF on{" "}
            {new Date(project.approval.approvedAt).toLocaleString()}.
            OpenTimestamps confirmation may take time, so check again later if
            it is still pending.
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <section className="proof-summary" aria-label="Proof status">
        {project.proofArtifacts.map((artifact) => (
          <article key={artifact.id}>
            <div>
              <span>{documentLabels[artifact.documentType]}</span>
              <strong>
                {artifact.status === "confirmed"
                  ? "Confirmed"
                  : artifact.status === "pending"
                    ? "Pending confirmation"
                    : "Needs attention"}
              </strong>
            </div>
            <code title="Digital fingerprint">{artifact.sha256}</code>
          </article>
        ))}
      </section>

      <ProofStatus
        projectId={id}
        initialStatus={project.status}
        specificationRevisionId={project.approval.specificationRevisionId}
        ndaRevisionId={project.approval.ndaRevisionId}
      />

      <section className="approved-documents">
        <div className="section-heading compact-heading">
          <div>
            <p className="section-label">Approved contents</p>
            <h2>Exact revisions in this proof</h2>
          </div>
          <Link href="/verify">Verify proof</Link>
        </div>
        {revisions.map((revision) => (
          <article key={revision.id} className="approved-document">
            <div className="approved-document-title">
              <h3>{documentLabels[revision.documentType]}</h3>
              <span>Version {revision.version}</span>
            </div>
            <DocumentPreview markdown={revision.content} />
          </article>
        ))}
      </section>
    </div>
  );
}
