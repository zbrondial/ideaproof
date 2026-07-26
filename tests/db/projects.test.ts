import { expect, it } from "vitest";

import { openTestStore } from "../helpers/open-test-store";

const projectInput = {
  idea: "  A local proof tool for concise idea documents.  ",
  technologyPreference: "TypeScript",
  ndaPurpose: "Evaluate a possible collaboration",
  ndaDetails: "",
};

it("creates, lists, and loads a project with a normalized title", () => {
  const store = openTestStore();

  try {
    const project = store.createProject(projectInput);

    expect(project.title).toBe("A local proof tool for concise idea documents.");
    expect(project.idea).toBe(projectInput.idea);
    expect(project.status).toBe("draft");
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

it("preserves every revision and selects one revision per document type", () => {
  const store = openTestStore();

  try {
    const project = store.createProject(projectInput);
    const addSpec = (content: string, feedback: string | null) =>
      store.addRevision({
        projectId: project.id,
        documentType: "specification",
        content,
        wordCount: 2,
        feedback,
        promptTemplateVersion: "spec-v1",
        model: "gpt-5.6",
        openaiResponseId: "resp_test",
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
      documentType: "nda",
      content: "# NDA",
      wordCount: 1,
      feedback: null,
      promptTemplateVersion: "nda-v1",
      model: "gpt-5.6",
      openaiResponseId: null,
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
