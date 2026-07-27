"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { ProviderSummary } from "@/server/config";

export function ProjectForm({
  providers,
}: {
  providers: ProviderSummary[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const provider = providers.find(
      (item) => item.provider === form.get("provider"),
    );

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ideaName: form.get("ideaName"),
          ownerName: form.get("ownerName"),
          idea: form.get("idea"),
          technologyPreference: form.get("technologyPreference"),
          ndaPurpose: form.get("ndaPurpose"),
          ndaDetails: form.get("ndaDetails"),
          provider: provider?.provider,
          model: provider?.model,
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
      <aside className="storage-callout">
        <strong>Stored on this machine</strong>
        <p>
          Your project and generated documents are saved in your local
          IdeaProof data folder. Generation sends the required information to
          your selected AI provider.
        </p>
      </aside>
      {providers.length > 1 ? (
        <fieldset className="model-picker">
          <legend>Model for this project</legend>
          <div className="model-options">
            {providers.map((provider, index) => (
              <label key={`${provider.provider}:${provider.model}`}>
                <input
                  type="radio"
                  name="provider"
                  value={provider.provider}
                  defaultChecked={index === 0}
                />
                <span>{provider.label}</span>
              </label>
            ))}
          </div>
          <p>
            This choice applies to both documents and every later revision.
          </p>
        </fieldset>
      ) : providers.length === 1 ? (
        <div className="model-summary">
          <span>Model for this project</span>
          <strong>{providers[0].label}</strong>
          <input
            type="hidden"
            name="provider"
            value={providers[0].provider}
          />
        </div>
      ) : (
        <div className="provider-missing" role="status">
          <strong>Set up an AI provider</strong>
          <p>
            Add an OpenAI or Anthropic API key before creating documents.{" "}
            <Link href="/setup">Open Setup</Link>
          </p>
        </div>
      )}
      <div className="field">
        <label htmlFor="ideaName">Idea name</label>
        <input
          id="ideaName"
          name="ideaName"
          required
          minLength={1}
          maxLength={120}
          aria-describedby="idea-name-help"
          placeholder="For example: IdeaProof"
        />
        <p className="field-help" id="idea-name-help">
          Use a short working name.
        </p>
      </div>
      <div className="field">
        <label htmlFor="ownerName">Owner’s full name</label>
        <input
          id="ownerName"
          name="ownerName"
          required
          minLength={1}
          maxLength={120}
          autoComplete="name"
          aria-describedby="owner-name-help"
          placeholder="For example: Ada Lovelace"
        />
        <p className="field-help" id="owner-name-help">
          This name appears on the technical specification and becomes part of
          its timestamped PDF.
        </p>
      </div>
      <div className="field">
        <label htmlFor="idea">Raw software idea</label>
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
          Preferred technology or target tech stack <span>Optional</span>
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
      <button
        className="button"
        type="submit"
        disabled={submitting || providers.length === 0}
      >
        {submitting
          ? "Creating project…"
          : "Generate technical specification and sample NDA"}
      </button>
      <p className="submit-note">
        One configured model is used for this project and all its revisions.
      </p>
    </form>
  );
}
