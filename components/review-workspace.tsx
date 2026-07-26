"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import type { DocumentType, Revision } from "@/server/db/projects";

import { DocumentPreview } from "./document-preview";

export function ReviewWorkspace({
  projectId,
  revisions,
  initialSpecificationId,
  initialNdaId,
}: {
  projectId: string;
  revisions: Revision[];
  initialSpecificationId: string;
  initialNdaId: string;
}) {
  const router = useRouter();
  const [documentType, setDocumentType] =
    useState<DocumentType>("specification");
  const [selected, setSelected] = useState({
    specification: initialSpecificationId,
    nda: initialNdaId,
  });
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const available = useMemo(
    () => revisions.filter((item) => item.documentType === documentType),
    [documentType, revisions],
  );
  const revision =
    available.find((item) => item.id === selected[documentType]) ?? available[0];

  async function revise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const response = await fetch(`/api/projects/${projectId}/revisions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentType,
        revisionId: revision.id,
        feedback,
      }),
    });
    const body = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setError(body.message ?? "The revision could not be created.");
      return;
    }
    setSelected((current) => ({
      ...current,
      [documentType]: body.revisionId,
    }));
    setFeedback("");
    router.refresh();
  }

  return (
    <div className="review-workspace">
      <div className="review-toolbar">
        <div className="document-tabs" role="tablist" aria-label="Documents">
          {(["specification", "nda"] as const).map((type) => (
            <button
              key={type}
              role="tab"
              type="button"
              aria-selected={documentType === type}
              onClick={() => setDocumentType(type)}
            >
              {type === "specification"
                ? "Technical specification"
                : "Sample NDA"}
            </button>
          ))}
        </div>
        <label className="version-select">
          <span>Version</span>
          <select
            value={revision.id}
            onChange={(event) =>
              setSelected((current) => ({
                ...current,
                [documentType]: event.target.value,
              }))
            }
          >
            {available.map((item) => (
              <option value={item.id} key={item.id}>
                Version {item.version} · {item.wordCount} words
              </option>
            ))}
          </select>
        </label>
      </div>
      <DocumentPreview markdown={revision.content} />
      <aside className="revision-panel">
        <form onSubmit={revise}>
          <label htmlFor="feedback">Request changes</label>
          <textarea
            id="feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            required
            minLength={3}
            maxLength={4_000}
            rows={4}
            placeholder="Be specific and keep the document concise."
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Creating revision…" : "Generate updated version"}
          </button>
        </form>
        <dl className="revision-summary">
          <div>
            <dt>Current version</dt>
            <dd>Version {revision.version}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{revision.wordCount} words</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>
              {revision.provider === "openai" ? "OpenAI" : "Claude"} ·{" "}
              {revision.model}
            </dd>
          </div>
        </dl>
        <div className="review-actions">
          <Link
            className="button"
            href={`/projects/${projectId}/approve?specificationRevisionId=${encodeURIComponent(selected.specification)}&ndaRevisionId=${encodeURIComponent(selected.nda)}`}
          >
            Approve selected revisions
          </Link>
        </div>
      </aside>
    </div>
  );
}
