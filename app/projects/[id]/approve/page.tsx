import Link from "next/link";

import { ApprovalButton } from "@/components/approval-button";
import { getProjectStore } from "@/server/db/projects";

export const dynamic = "force-dynamic";

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    specificationRevisionId?: string;
    ndaRevisionId?: string;
  }>;
}) {
  const { id } = await params;
  const selected = await searchParams;
  const project = getProjectStore().getProject(id);
  if (project.approval) {
    return (
      <div className="content-shell narrow-shell">
        <div className="empty-state">
          <p className="section-label">Approval already recorded</p>
          <h1>These documents are locked.</h1>
          <Link className="button" href={`/projects/${id}/proof`}>
            View proof
          </Link>
        </div>
      </div>
    );
  }

  const specification = project.revisions.find(
    (revision) =>
      revision.documentType === "specification" &&
      revision.id ===
        (selected.specificationRevisionId ??
          project.selectedSpecificationRevisionId),
  );
  const nda = project.revisions.find(
    (revision) =>
      revision.documentType === "nda" &&
      revision.id ===
        (selected.ndaRevisionId ?? project.selectedNdaRevisionId),
  );
  if (!specification || !nda) {
    return (
      <div className="content-shell narrow-shell">
        <div className="empty-state">
          <h1>Select both revisions before approval.</h1>
          <Link className="button" href={`/projects/${id}/review`}>
            Return to review
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="content-shell narrow-shell">
      <div className="page-heading">
        <p className="section-label">Final approval</p>
        <h1>Approve these documents?</h1>
        <p>
          Review the selected versions below. Approval makes these PDFs
          permanent and creates a matching OpenTimestamps proof for each one.
        </p>
      </div>
      <div className="approval-summary">
        <article>
          <span>Technical specification</span>
          <strong>Version {specification.version}</strong>
          <small>{specification.wordCount} words</small>
        </article>
        <article>
          <span>Sample NDA</span>
          <strong>Version {nda.version}</strong>
          <small>{nda.wordCount} words</small>
        </article>
      </div>
      {project.ownerName ? (
        <p className="owner-claim-summary">
          <strong>Prepared and claimed by:</strong> {project.ownerName}
        </p>
      ) : null}
      <div className="notice-card">
        <h2>Before you approve</h2>
        <p>
          The approved versions cannot be edited. OpenTimestamps confirmation
          can take time, but you can download the PDFs and their proofs as soon
          as the proof package is ready.
        </p>
      </div>
      <ApprovalButton
        projectId={id}
        specificationRevisionId={specification.id}
        ndaRevisionId={nda.id}
        requiresOwnershipConfirmation={Boolean(project.ownerName)}
      />
    </div>
  );
}
