"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ProjectForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idea: form.get("idea"),
          technologyPreference: form.get("technologyPreference"),
          ndaPurpose: form.get("ndaPurpose"),
          ndaDetails: form.get("ndaDetails"),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message ?? "The project could not be created.");
        return;
      }
      router.push(`/projects/${body.id}?generate=1`);
    } catch {
      setError("IdeaProof could not reach its local server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="project-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="idea">Your idea</label>
        <textarea
          id="idea"
          name="idea"
          required
          minLength={20}
          maxLength={10_000}
          rows={7}
          placeholder="Describe what you want to build, who it helps, and the result it should create."
        />
      </div>
      <div className="field">
        <label htmlFor="technologyPreference">
          Technology preference <span>Optional</span>
        </label>
        <input
          id="technologyPreference"
          name="technologyPreference"
          maxLength={1_000}
          placeholder="For example: Next.js, SQLite, or no preference"
        />
      </div>
      <div className="field">
        <label htmlFor="ndaPurpose">NDA purpose</label>
        <textarea
          id="ndaPurpose"
          name="ndaPurpose"
          required
          minLength={10}
          maxLength={2_000}
          rows={3}
          placeholder="For example: Discuss a possible product collaboration"
        />
      </div>
      <div className="field">
        <label htmlFor="ndaDetails">
          Additional NDA details <span>Optional</span>
        </label>
        <textarea
          id="ndaDetails"
          name="ndaDetails"
          maxLength={4_000}
          rows={4}
          aria-describedby="nda-details-help"
          placeholder="Add only facts you already know."
        />
        <p className="field-help" id="nda-details-help">
          Party A, Party B, Effective Date, and Confidentiality Period stay
          blank unless you include them here.
        </p>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Creating project…" : "Create documents"}
      </button>
      <p className="submit-note">
        Generation sends the required content to OpenAI using your API key.
      </p>
    </form>
  );
}
