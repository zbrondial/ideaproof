"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function IdeaEditor({
  projectId,
  ideaName,
  idea,
}: {
  projectId: string;
  ideaName: string;
  idea: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/ideas/${projectId}/idea`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ideaName: form.get("ideaName"),
          idea: form.get("idea"),
          updateNote: form.get("updateNote"),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.message ?? "The idea update could not be saved.");
        return;
      }
      setMessage(
        "Idea update saved locally. Regenerate both documents before approval.",
      );
      router.refresh();
    } catch {
      setMessage("IdeaProof could not reach its local server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="idea-editor">
      <summary>Edit idea details</summary>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="editIdeaName">Idea name</label>
          <input
            id="editIdeaName"
            name="ideaName"
            defaultValue={ideaName}
            required
            minLength={1}
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="editIdea">Raw software idea</label>
          <textarea
            id="editIdea"
            name="idea"
            defaultValue={idea}
            required
            minLength={20}
            maxLength={10_000}
            rows={7}
          />
        </div>
        <div className="field">
          <label htmlFor="updateNote">
            Update note <span>Optional</span>
          </label>
          <input id="updateNote" name="updateNote" maxLength={500} />
        </div>
        <button className="button" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save idea update"}
        </button>
        {message ? (
          <p className="action-message" role="status">
            {message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
