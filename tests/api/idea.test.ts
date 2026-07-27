import { expect, it } from "vitest";

import {
  handleIdeaUpdate,
  POST,
} from "@/app/api/projects/[id]/idea/route";

import { openTestStore } from "../helpers/open-test-store";

function draftProject(store: ReturnType<typeof openTestStore>) {
  return store.createProject({
    ideaName: "IdeaProof",
    ownerName: "Ada Lovelace",
    idea: "A local app that timestamps concise idea documents.",
    ndaPurpose: "Discuss a possible product collaboration.",
    provider: "openai",
    model: "gpt-5.6",
  });
}

it("appends a complete local idea snapshot", async () => {
  const store = openTestStore();
  try {
    const project = draftProject(store);
    const response = await handleIdeaUpdate({
      projectId: project.id,
      body: {
        ideaName: "Ray",
        idea: "A more detailed AI assistant concept for indie developers.",
        updateNote: "Clarified the product direction.",
      },
      store,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      version: 2,
      ideaName: "Ray",
    });
    expect(store.getIdeaVersions(project.id)).toHaveLength(2);
  } finally {
    store.closeAndRemove();
  }
});

it("rejects invalid idea updates", async () => {
  const store = openTestStore();
  try {
    const project = draftProject(store);
    const response = await handleIdeaUpdate({
      projectId: project.id,
      body: { ideaName: "", idea: "Too short" },
      store,
    });

    expect(response.status).toBe(400);
    expect(store.getIdeaVersions(project.id)).toHaveLength(1);
  } finally {
    store.closeAndRemove();
  }
});

it("returns a safe validation error for malformed JSON", async () => {
  const response = await POST(
    new Request("http://127.0.0.1/api/projects/project-id/idea", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
    { params: Promise.resolve({ id: "project-id" }) },
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "PROJECT_IDEA_INVALID",
  });
});

it("rejects idea updates after approval", async () => {
  const store = openTestStore();
  try {
    const project = draftProject(store);
    const add = (documentType: "specification" | "nda") =>
      store.addRevision({
        projectId: project.id,
        ideaVersionId: project.currentIdeaVersionId,
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
    const specification = add("specification");
    const nda = add("nda");
    store.createApproval({
      projectId: project.id,
      specificationRevisionId: specification.id,
      ndaRevisionId: nda.id,
      packagePath: "proof.zip",
      artifacts: [],
    });

    const response = await handleIdeaUpdate({
      projectId: project.id,
      body: {
        ideaName: "Ray",
        idea: "A more detailed AI assistant concept for indie developers.",
      },
      store,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "PROJECT_IMMUTABLE" });
  } finally {
    store.closeAndRemove();
  }
});
