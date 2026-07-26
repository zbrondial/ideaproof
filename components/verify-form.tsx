"use client";

import { useState, type FormEvent } from "react";

type VerifyResult = {
  status: "confirmed" | "pending" | "mismatch" | "invalid";
  sha256: string;
  bitcoinBlockHeight?: number;
  confirmedAt?: string;
  message: string;
};

function formatSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function VerifyForm() {
  const [document, setDocument] = useState<File>();
  const [proof, setProof] = useState<File>();
  const [result, setResult] = useState<VerifyResult>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || !proof) return;
    setSubmitting(true);
    setError("");
    setResult(undefined);
    const body = new FormData();
    body.set("document", document);
    body.set("proof", proof);
    try {
      const response = await fetch("/api/verify", { method: "POST", body });
      const responseBody = await response.json();
      if (!response.ok) {
        setError(responseBody.message ?? "The files could not be verified.");
        return;
      }
      setResult(responseBody);
    } catch {
      setError("IdeaProof could not reach its local server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="verify-form" onSubmit={submit}>
      <div className="upload-grid">
        <label className="upload-field">
          <span>PDF file</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            required
            onChange={(event) => setDocument(event.target.files?.[0])}
          />
          <small>
            {document
              ? `${document.name} · ${formatSize(document.size)}`
              : "Choose the exact PDF. Maximum 10 MB."}
          </small>
        </label>
        <label className="upload-field">
          <span>OpenTimestamps proof</span>
          <input
            type="file"
            accept=".ots,application/octet-stream"
            required
            onChange={(event) => setProof(event.target.files?.[0])}
          />
          <small>
            {proof
              ? `${proof.name} · ${formatSize(proof.size)}`
              : "Choose its matching .ots file. Maximum 1 MB."}
          </small>
        </label>
      </div>
      <button
        className="button"
        type="submit"
        disabled={!document || !proof || submitting}
      >
        {submitting ? "Verifying…" : "Verify proof"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <section
          className="verification-result"
          data-status={result.status}
          aria-live="polite"
        >
          <p className="section-label">Verification result</p>
          <h2>
            {result.status === "confirmed"
              ? "Proof confirmed"
              : result.status === "pending"
                ? "Confirmation pending"
                : result.status === "mismatch"
                  ? "Files do not match"
                  : "Invalid proof"}
          </h2>
          <p>{result.message}</p>
          <details>
            <summary>Technical details</summary>
            <dl>
              <div>
                <dt>SHA-256</dt>
                <dd>
                  <code>{result.sha256}</code>
                </dd>
              </div>
              {result.confirmedAt ? (
                <div>
                  <dt>Confirmed by</dt>
                  <dd>{result.confirmedAt}</dd>
                </div>
              ) : null}
            </dl>
          </details>
        </section>
      ) : null}
    </form>
  );
}
