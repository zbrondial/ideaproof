import { vi } from "vitest";

import { handleGenerate } from "@/app/api/ideas/[id]/generate/[documentType]/route";
import { handleRevision } from "@/app/api/ideas/[id]/revisions/route";
import type { DocumentType } from "@/server/db/projects";

import { openTestStore } from "../helpers/open-test-store";

export const validGeneratedSpec = {
  documentType: "specification" as const,
  markdown: "# IdeaProof\n\nA concise local proof tool.",
  wordCount: 7,
  promptTemplateVersion: "spec-v1",
  provider: "openai" as const,
  model: "gpt-5.6",
  providerResponseId: "resp_spec",
};

export const validGeneratedNda = {
  documentType: "nda" as const,
  markdown: "# Sample Non-Disclosure Agreement\n\nA concise template.",
  wordCount: 7,
  promptTemplateVersion: "nda-v1",
  provider: "openai" as const,
  model: "gpt-5.6",
  providerResponseId: "resp_nda",
};

function testRevision(
  projectId: string,
  ideaVersionId: string,
  documentType: DocumentType,
) {
  return {
    projectId,
    ideaVersionId,
    documentType,
    content: documentType === "nda" ? "# Existing NDA" : "# Existing spec",
    wordCount: 3,
    feedback: null,
    promptTemplateVersion: `${documentType}-v1`,
    provider: "openai" as const,
    model: "gpt-5.6",
    providerResponseId: "resp_existing",
  };
}

export function createGenerationHarness(
  options: {
    withExistingDocuments: boolean;
    ownerName?: string;
  } = {
    withExistingDocuments: false,
  },
) {
  const store = openTestStore();
  const project = store.createProject({
    ideaName: "IdeaProof",
    ownerName: options.ownerName,
    idea: "A local web app that creates concise idea documents and timestamps approved PDFs.",
    technologyPreference: "Next.js",
    ndaPurpose: "Discuss a possible product collaboration",
    ndaDetails: "",
    provider: "openai",
    model: "gpt-5.6",
  });
  const mockGeneration = {
    specification: vi.fn(),
    nda: vi.fn(),
    revise: vi.fn(),
  };
  const spec = options.withExistingDocuments
    ? store.addRevision(
        testRevision(project.id, project.currentIdeaVersionId, "specification"),
      )
    : undefined;
  const nda = options.withExistingDocuments
    ? store.addRevision(
        testRevision(project.id, project.currentIdeaVersionId, "nda"),
      )
    : undefined;
  if (spec) store.selectRevision(project.id, "specification", spec.id);
  if (nda) store.selectRevision(project.id, "nda", nda.id);

  return {
    store,
    project,
    mockGeneration,
    spec,
    nda,
    close: () => store.closeAndRemove(),
    generate: (documentType: DocumentType) =>
      handleGenerate({
        projectId: project.id,
        documentType,
        store,
        generation: mockGeneration,
      }),
    revise: (body: {
      documentType: DocumentType;
      revisionId: string;
      feedback: string;
    }) =>
      handleRevision({
        projectId: project.id,
        body,
        store,
        generation: mockGeneration,
      }),
  };
}
