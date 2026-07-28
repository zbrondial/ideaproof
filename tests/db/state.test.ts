import { expect, it } from "vitest";

import { openTestStore } from "../helpers/open-test-store";

const projectInput = {
  ideaName: "IdeaProof",
  idea: "A local proof tool for concise idea documents",
  technologyPreference: "TypeScript",
  ndaPurpose: "Discuss a possible collaboration",
  ndaDetails: "",
  provider: "openai" as const,
  model: "gpt-5.6",
};

function addRevision(
  store: ReturnType<typeof openTestStore>,
  projectId: string,
  documentType: "specification" | "nda",
) {
  return store.addRevision({
    projectId,
    ideaVersionId: store.getProject(projectId).currentIdeaVersionId,
    documentType,
    content: documentType === "nda" ? "# NDA" : "# Specification",
    wordCount: 1,
    feedback: null,
    promptTemplateVersion: `${documentType}-v1`,
    provider: "openai",
    model: "gpt-5.6",
    providerResponseId: "resp_test",
  });
}

it("allows only declared compare-and-set project transitions", () => {
  const store = openTestStore();

  try {
    const project = store.createProject(projectInput);

    expect(() =>
      store.transitionProject(project.id, "draft", "confirmed"),
    ).toThrowError(
      expect.objectContaining({ code: "PROJECT_STATE_INVALID" }),
    );

    store.transitionProject(project.id, "draft", "generating");
    expect(store.getProject(project.id).status).toBe("generating");

    expect(() =>
      store.transitionProject(project.id, "draft", "generating"),
    ).toThrowError(
      expect.objectContaining({ code: "PROJECT_STATE_INVALID" }),
    );
  } finally {
    store.closeAndRemove();
  }
});

it("creates one immutable approval for revisions from the same project", () => {
  const store = openTestStore();

  try {
    const project = store.createProject(projectInput);
    const specification = addRevision(store, project.id, "specification");
    const nda = addRevision(store, project.id, "nda");
    const approval = store.createApproval({
      projectId: project.id,
      specificationRevisionId: specification.id,
      ndaRevisionId: nda.id,
      packagePath: `approvals/${project.id}/package.zip`,
      artifacts: [
        {
          documentType: "specification",
          pdfPath: "specification.pdf",
          markdownPath: "specification.md",
          otsPath: "specification.pdf.ots",
          sha256: "a".repeat(64),
        },
        {
          documentType: "nda",
          pdfPath: "nda.pdf",
          markdownPath: "nda.md",
          otsPath: "nda.pdf.ots",
          sha256: "b".repeat(64),
        },
      ],
    });

    expect(approval.projectId).toBe(project.id);
    expect(store.getProject(project.id).proofArtifacts).toHaveLength(2);
    expect(() => store.updateProjectTitle(project.id, "Changed later")).toThrowError(
      expect.objectContaining({ code: "PROJECT_IMMUTABLE" }),
    );
    expect(() =>
      store.addRevision({
        projectId: project.id,
        ideaVersionId: project.currentIdeaVersionId,
        documentType: "nda",
        content: "# Later NDA",
        wordCount: 2,
        feedback: "Change it",
        promptTemplateVersion: "nda-v1",
        provider: "openai",
        model: "gpt-5.6",
        providerResponseId: null,
      }),
    ).toThrowError(expect.objectContaining({ code: "PROJECT_IMMUTABLE" }));
    expect(() =>
      store.selectRevision(project.id, "nda", nda.id),
    ).toThrowError(expect.objectContaining({ code: "PROJECT_IMMUTABLE" }));
    expect(() =>
      store.createApproval({
        projectId: project.id,
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
        packagePath: "replacement.zip",
        artifacts: [],
      }),
    ).toThrowError(expect.objectContaining({ code: "APPROVAL_EXISTS" }));
  } finally {
    store.closeAndRemove();
  }
});

it("rejects approval revisions that belong to another project", () => {
  const store = openTestStore();

  try {
    const firstProject = store.createProject(projectInput);
    const secondProject = store.createProject({
      ...projectInput,
      idea: "Another project",
    });
    const specification = addRevision(
      store,
      firstProject.id,
      "specification",
    );
    const nda = addRevision(store, secondProject.id, "nda");

    expect(() =>
      store.createApproval({
        projectId: firstProject.id,
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
        packagePath: "package.zip",
        artifacts: [],
      }),
    ).toThrowError(
      expect.objectContaining({ code: "REVISION_PROJECT_MISMATCH" }),
    );
  } finally {
    store.closeAndRemove();
  }
});
