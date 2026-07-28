"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AiProvider } from "@/server/config";

type DocumentType = "specification" | "nda";
type GenerationStep =
  | "preparing"
  | "generating-specification"
  | "generating-nda"
  | "saving"
  | "complete"
  | "failed";

const messages: Record<GenerationStep, string> = {
  preparing: "Organizing the details you supplied.",
  "generating-specification": "Creating the technical specification.",
  "generating-nda": "Creating the sample NDA.",
  saving: "Saving both documents as exact revisions.",
  complete: "Both documents are ready for review.",
  failed: "Generation paused.",
};

export function GenerationProgress({
  projectId,
  provider,
  model,
  autoStart = true,
  onComplete = "review",
}: {
  projectId: string;
  provider: AiProvider;
  model: string;
  autoStart?: boolean;
  onComplete?: "review" | "refresh";
}) {
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
      `/api/ideas/${projectId}/generate/${documentType}`,
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
    if (onComplete === "refresh") {
      router.refresh();
    } else {
      router.replace(`/projects/${projectId}/review`);
    }
  }, [generate, onComplete, projectId, router]);

  useEffect(() => {
    if (!autoStart) return;
    if (started.current) return;
    started.current = true;
    void run();
  }, [autoStart, run]);

  return (
    <section className="generation-panel" aria-live="polite">
      <div className="generation-orbit" aria-hidden="true">
        <span />
      </div>
      <h1>Preparing your documents</h1>
      <p className="model-metadata">
        {provider === "openai" ? "OpenAI" : "Claude"} · {model}
      </p>
      <p>
        {step === "failed" ? message : messages[step]}
      </p>
      <ol className="progress-list">
        <li data-active={step === "preparing"}>
          Organizing product requirements
        </li>
        <li data-active={step === "generating-specification"}>
          Generating technical specification
        </li>
        <li data-active={step === "generating-nda"}>
          Generating sample NDA
        </li>
        <li data-active={step === "saving" || step === "complete"}>
          Saving document revisions
        </li>
      </ol>
      {!autoStart && step === "preparing" ? (
        <button className="button" type="button" onClick={() => void run()}>
          Regenerate both documents · 2 AI requests
        </button>
      ) : null}
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
