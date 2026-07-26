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
        <h1>Lock the exact documents you reviewed.</h1>
        <p>
          IdeaProof will render these revisions as PDFs, hash their exact
          bytes, and submit timestamp commitments to public calendars.
        </p>
      </div>
      <div className="approval-summary">
        <article>
          <span>Technical specification</span>
          <strong>Version {specification.version}</strong>
          <small>{specification.wordCount} words</small>
        </article>
        <article>
          <span>Mutual NDA</span>
          <strong>Version {nda.version}</strong>
          <small>{nda.wordCount} words</small>
        </article>
      </div>
      <div className="notice-card">
        <h2>What the timestamp proves</h2>
        <p>
          It can later show that these exact PDF bytes existed by a confirmed
          time. It does not prove ownership, authorship, or legal validity.
        </p>
      </div>
      <ApprovalButton
        projectId={id}
        specificationRevisionId={specification.id}
        ndaRevisionId={nda.id}
      />
    </div>
  );
}
