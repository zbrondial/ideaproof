"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type DocumentType = "specification" | "nda";
type GenerationStep =
  | "preparing"
  | "generating-specification"
  | "generating-nda"
  | "saving"
  | "complete"
  | "failed";

const labels: Record<GenerationStep, string> = {
  preparing: "Preparing your project",
  "generating-specification": "Writing the technical specification",
  "generating-nda": "Writing the mutual NDA",
  saving: "Saving both exact revisions",
  complete: "Documents ready for review",
  failed: "Generation paused",
};

export function GenerationProgress({ projectId }: { projectId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [step, setStep] = useState<GenerationStep>("preparing");
  const [failedDocument, setFailedDocument] = useState<DocumentType | null>(
    null,
  );
  const [message, setMessage] = useState("");

  const generate = useCallback(async (documentType: DocumentType) => {
    setStep(
      documentType === "specification"
        ? "generating-specification"
        : "generating-nda",
    );
    const response = await fetch(
      `/api/projects/${projectId}/generate/${documentType}`,
      { method: "POST" },
    );
    if (!response.ok) {
      const body = await response.json();
      setFailedDocument(documentType);
      setMessage(body.message ?? "Generation could not continue.");
      setStep("failed");
      return false;
    }
    return true;
  }, [projectId]);

  const run = useCallback(async (from: DocumentType = "specification") => {
    setMessage("");
    setFailedDocument(null);
    if (from === "specification" && !(await generate("specification"))) return;
    if (!(await generate("nda"))) return;
    setStep("saving");
    setStep("complete");
    router.replace(`/projects/${projectId}/review`);
  }, [generate, projectId, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  return (
    <section className="generation-panel" aria-live="polite">
      <div className="generation-orbit" aria-hidden="true">
        <span />
      </div>
      <p className="section-label">Creating your documents</p>
      <h1>{labels[step]}</h1>
      <p>
        {step === "failed"
          ? message
          : "Each completed document is saved as its own revision. You will review both before approval."}
      </p>
      <ol className="progress-list">
        <li data-active={step === "generating-specification"}>
          Technical specification
        </li>
        <li data-active={step === "generating-nda"}>Mutual NDA</li>
        <li data-active={step === "saving" || step === "complete"}>
          Save revisions
        </li>
      </ol>
      {failedDocument ? (
        <button
          className="button"
          type="button"
          onClick={() => void run(failedDocument)}
        >
          Retry {failedDocument === "nda" ? "NDA" : "specification"}
        </button>
      ) : null}
    </section>
  );
}
