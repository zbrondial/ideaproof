"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalButton({
  projectId,
  specificationRevisionId,
  ndaRevisionId,
  requiresOwnershipConfirmation = false,
}: {
  projectId: string;
  specificationRevisionId: string;
  ndaRevisionId: string;
  requiresOwnershipConfirmation?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);

  async function approve() {
    setSubmitting(true);
    setError("");
    const response = await fetch(`/api/projects/${projectId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        specificationRevisionId,
        ndaRevisionId,
        ownershipConfirmed,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setSubmitting(false);
      setError(body.message ?? "The proof package could not be created.");
      return;
    }
    router.push(body.proofUrl);
    router.refresh();
  }

  return (
    <div className="approval-submit">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {requiresOwnershipConfirmation ? (
        <label className="ownership-confirmation">
          <input
            type="checkbox"
            checked={ownershipConfirmed}
            onChange={(event) =>
              setOwnershipConfirmed(event.target.checked)
            }
          />
          <span>
            I confirm that I prepared and claim ownership of this documented
            idea.
          </span>
        </label>
      ) : null}
      <div className="approval-buttons">
        <Link
          className="button button-secondary"
          href={`/projects/${projectId}/review`}
        >
          Keep reviewing
        </Link>
        <button
          className="button"
          type="button"
          onClick={approve}
          disabled={
            submitting ||
            (requiresOwnershipConfirmation && !ownershipConfirmed)
          }
        >
          {submitting ? "Creating proof…" : "Approve and create proof"}
        </button>
      </div>
      <p>
        Approval locks these exact revisions. Later edits require a new
        project and proof.
      </p>
    </div>
  );
}
