"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalButton({
  projectId,
  specificationRevisionId,
  ndaRevisionId,
}: {
  projectId: string;
  specificationRevisionId: string;
  ndaRevisionId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    setSubmitting(true);
    setError("");
    const response = await fetch(`/api/projects/${projectId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ specificationRevisionId, ndaRevisionId }),
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
          disabled={submitting}
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
