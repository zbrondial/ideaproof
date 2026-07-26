"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ProjectStatus } from "@/server/db/projects";

export function ProofStatus({
  projectId,
  initialStatus,
  specificationRevisionId,
  ndaRevisionId,
}: {
  projectId: string;
  initialStatus: ProjectStatus;
  specificationRevisionId: string;
  ndaRevisionId: string;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function check() {
    setChecking(true);
    setMessage("");
    const response = await fetch(`/api/projects/${projectId}/proof/check`, {
      method: "POST",
    });
    const body = await response.json();
    setChecking(false);
    if (!response.ok) {
      setMessage(body.message ?? "The proofs could not be checked.");
      return;
    }
    setMessage(
      body.status === "confirmed"
        ? "Both proofs are confirmed."
        : body.status === "pending"
          ? "Confirmation is still pending. Check again later."
          : "The proof needs attention.",
    );
    router.refresh();
  }

  async function retry() {
    setChecking(true);
    setMessage("");
    const response = await fetch(`/api/projects/${projectId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ specificationRevisionId, ndaRevisionId }),
    });
    const body = await response.json();
    setChecking(false);
    if (!response.ok) {
      setMessage(body.message ?? "Timestamping could not be retried.");
      return;
    }
    setMessage("Timestamp commitments were resubmitted.");
    router.refresh();
  }

  return (
    <div className="proof-actions">
      {initialStatus === "failed" ? (
        <button
          className="button"
          type="button"
          disabled={checking}
          onClick={retry}
        >
          {checking ? "Retrying…" : "Retry timestamping"}
        </button>
      ) : initialStatus !== "confirmed" ? (
        <button
          className="button"
          type="button"
          disabled={checking}
          onClick={check}
        >
          {checking ? "Checking…" : "Check confirmation"}
        </button>
      ) : null}
      {initialStatus !== "failed" ? (
        <a
          className="button button-secondary"
          href={`/api/projects/${projectId}/package`}
        >
          Download proof package
        </a>
      ) : null}
      {message ? (
        <p className="action-message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
