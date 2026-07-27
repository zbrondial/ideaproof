import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { expect, it } from "vitest";

import { createProjectStore } from "@/server/db/projects";

import { openTestStore } from "../helpers/open-test-store";

const projectInput = {
  ideaName: "IdeaProof",
  ownerName: "Ada Lovelace",
  idea: "  A local proof tool for concise idea documents.  ",
  technologyPreference: "TypeScript",
  ndaPurpose: "Evaluate a possible collaboration",
  ndaDetails: "",
  provider: "openai" as const,
  model: "gpt-5.6",
};

it("creates, lists, and loads a project with its Idea name", () => {
  const store = openTestStore();

  try {
    const project = store.createProject(projectInput);

    expect(project.title).toBe("IdeaProof");
    expect(project.ownerName).toBe("Ada Lovelace");
    expect(project.idea).toBe(projectInput.idea);
    expect(project.status).toBe("draft");
    expect(store.getIdeaVersions(project.id)).toEqual([
      expect.objectContaining({
        version: 1,
        ideaName: "IdeaProof",
        idea: projectInput.idea,
        updateNote: null,
      }),
    ]);
    expect(store.listProjects({ search: "proof tool" })).toEqual([
      expect.objectContaining({ id: project.id, status: "draft" }),
    ]);
    expect(store.getProject(project.id)).toEqual(
      expect.objectContaining({
        ...project,
        revisions: [],
        approval: null,
      }),
    );
  } finally {
    store.closeAndRemove();
  }
});

it("appends idea updates and locks them after approval", () => {
  const store = openTestStore();

  try {
    const project = store.createProject(projectInput);
    const updated = store.updateIdea(project.id, {
      ideaName: "IdeaProof Next",
      idea: "A more detailed local proof tool for early software ideas.",
      updateNote: "Expanded the target workflow.",
    });
    expect(updated).toMatchObject({
      title: "IdeaProof Next",
      idea: "A more detailed local proof tool for early software ideas.",
    });
    expect(store.getIdeaVersions(project.id).map((item) => item.version)).toEqual([
      1, 2,
    ]);

    const addRevision = (documentType: "specification" | "nda") =>
      store.addRevision({
        projectId: project.id,
        ideaVersionId: updated.currentIdeaVersionId,
        documentType,
        content: "# Document",
        wordCount: 1,
        feedback: null,
        promptTemplateVersion:
          documentType === "specification" ? "spec-v5" : "nda-v5",
        provider: "openai",
        model: "gpt-5.6",
        providerResponseId: null,
      });
    const specification = addRevision("specification");
    const nda = addRevision("nda");
    store.createApproval({
      projectId: project.id,
      specificationRevisionId: specification.id,
      ndaRevisionId: nda.id,
      packagePath: "/tmp/package.zip",
      artifacts: [],
    });

    expect(() =>
      store.updateIdea(project.id, {
        ideaName: "Changed",
        idea: "Changed after approval",
      }),
    ).toThrowError(expect.objectContaining({ code: "PROJECT_IMMUTABLE" }));
  } finally {
    store.closeAndRemove();
  }
});

it("preserves every revision and selects one revision per document type", () => {
  const store = openTestStore();

  try {
    const project = store.createProject(projectInput);
    const addSpec = (content: string, feedback: string | null) =>
      store.addRevision({
        projectId: project.id,
        ideaVersionId: project.currentIdeaVersionId,
        documentType: "specification",
        content,
        wordCount: 2,
        feedback,
        promptTemplateVersion: "spec-v1",
        provider: "openai",
        model: "gpt-5.6",
        providerResponseId: "resp_test",
      });

    const first = addSpec("# Version one", null);
    const second = addSpec("# Version two", "Shorter");
    store.selectRevision(project.id, "specification", first.id);

    expect(
      store
        .getRevisions(project.id, "specification")
        .map((revision) => revision.version),
    ).toEqual([1, 2]);
    expect(store.getProject(project.id).selectedSpecificationRevisionId).toBe(
      first.id,
    );
    expect(second.version).toBe(2);
  } finally {
    store.closeAndRemove();
  }
});

it("rejects selecting a revision from another project", () => {
  const store = openTestStore();

  try {
    const firstProject = store.createProject(projectInput);
    const secondProject = store.createProject({
      ...projectInput,
      idea: "A different idea",
    });
    const revision = store.addRevision({
      projectId: secondProject.id,
      ideaVersionId: secondProject.currentIdeaVersionId,
      documentType: "nda",
      content: "# NDA",
      wordCount: 1,
      feedback: null,
      promptTemplateVersion: "nda-v1",
      provider: "openai",
      model: "gpt-5.6",
      providerResponseId: null,
    });

    expect(() =>
      store.selectRevision(firstProject.id, "nda", revision.id),
    ).toThrowError(
      expect.objectContaining({ code: "REVISION_PROJECT_MISMATCH" }),
    );
  } finally {
    store.closeAndRemove();
  }
});

it("stores one provider and model for the project and its revisions", () => {
  const store = openTestStore();

  try {
    const project = store.createProject({
      ideaName: "Local Proof",
      idea: "A local tool that proves exact generated idea documents.",
      technologyPreference: "Next.js",
      ndaPurpose: "Evaluate a possible collaboration",
      ndaDetails: "",
      provider: "anthropic",
      model: "claude-opus-4-8",
    });
    const revision = store.addRevision({
      projectId: project.id,
      ideaVersionId: project.currentIdeaVersionId,
      documentType: "specification",
      content: "# Product Overview\n\nFixture",
      wordCount: 3,
      feedback: null,
      promptTemplateVersion: "spec-v2",
      provider: project.provider,
      model: project.model,
      providerResponseId: "msg_fixture",
    });

    expect(store.getProject(project.id)).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-4-8",
    });
    expect(revision).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-4-8",
      providerResponseId: "msg_fixture",
    });
  } finally {
    store.closeAndRemove();
  }
});

it("rejects a revision from a different provider or model", () => {
  const store = openTestStore();

  try {
    const project = store.createProject(projectInput);
    expect(() =>
      store.addRevision({
        projectId: project.id,
        ideaVersionId: project.currentIdeaVersionId,
        documentType: "specification",
        content: "# Product Overview\n\nFixture",
        wordCount: 3,
        feedback: null,
        promptTemplateVersion: "spec-v2",
        provider: "anthropic",
        model: "claude-opus-4-8",
        providerResponseId: "msg_fixture",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "PROJECT_PROVIDER_MISMATCH" }),
    );
  } finally {
    store.closeAndRemove();
  }
});

it("migrates existing OpenAI revisions without losing their model or response ID", () => {
  const directory = mkdtempSync(join(tmpdir(), "ideaproof-migration-"));
  const databasePath = join(directory, "legacy.sqlite");
  const projectId = "00000000-0000-4000-8000-000000000001";
  const revisionId = "00000000-0000-4000-8000-000000000002";
  const now = "2026-07-25T00:00:00.000Z";
  const legacy = new DatabaseSync(databasePath);
  let legacyOpen = true;

  try {
    legacy.exec(readFileSync("server/db/migrations/001-initial.sql", "utf8"));
    legacy.exec("PRAGMA user_version = 1");
    legacy
      .prepare(
        `INSERT INTO projects
          (id, title, idea, technology_preference, nda_purpose, nda_details,
           status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      )
      .run(
        projectId,
        "Legacy idea",
        "A legacy locally stored idea",
        "",
        "Evaluation",
        "",
        now,
        now,
      );
    legacy
      .prepare(
        `INSERT INTO revisions
          (id, project_id, document_type, version, content, word_count,
           feedback, prompt_template_version, model, openai_response_id,
           created_at)
         VALUES (?, ?, 'specification', 1, ?, 3, NULL, ?, ?, ?, ?)`,
      )
      .run(
        revisionId,
        projectId,
        "# Legacy\n\nDocument",
        "spec-v1",
        "gpt-5.6",
        "resp_legacy",
        now,
      );
    legacy.close();
    legacyOpen = false;

    const migrated = createProjectStore(databasePath);
    try {
      expect(migrated.getProject(projectId)).toMatchObject({
        ownerName: "",
        currentIdeaVersionId: projectId,
        provider: "openai",
        model: "gpt-5.6",
        revisions: [
          expect.objectContaining({
            ideaVersionId: projectId,
            provider: "openai",
            providerResponseId: "resp_legacy",
          }),
        ],
      });
      expect(migrated.getIdeaVersions(projectId)).toEqual([
        expect.objectContaining({
          id: projectId,
          version: 1,
          ideaName: "Legacy idea",
        }),
      ]);
    } finally {
      migrated.close();
    }
  } finally {
    if (legacyOpen) legacy.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
