import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

import { strFromU8, unzipSync } from "fflate";
import { afterEach, expect, it } from "vitest";

import { handleApprove } from "@/app/api/projects/[id]/approve/route";
import { renderPdf as renderDocumentPdf } from "@/server/documents/pdf";
import { AppError } from "@/server/errors";

import { openTestStore } from "../helpers/open-test-store";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function reviewProject(
  store: ReturnType<typeof openTestStore>,
  ownerName = "Private Owner Sentinel",
) {
  const project = store.createProject({
    ideaName: "IdeaProof",
    ownerName,
    idea: "A local app that makes concise idea documents and timestamp proofs",
    ndaPurpose: "Discuss a possible product collaboration",
    provider: "openai",
    model: "gpt-5.6",
  });
  store.transitionProject(project.id, "draft", "generating");
  const specification = store.addRevision({
    projectId: project.id,
    ideaVersionId: project.currentIdeaVersionId,
    documentType: "specification",
    content: "# Technical Specification\n\nA concise implementation.",
    wordCount: 5,
    feedback: null,
    promptTemplateVersion: "spec-v1",
    provider: "openai",
    model: "gpt-5.6",
    providerResponseId: "resp_spec",
  });
  const nda = store.addRevision({
    projectId: project.id,
    ideaVersionId: project.currentIdeaVersionId,
    documentType: "nda",
    content:
      "# Sample Non-Disclosure Agreement\n\nParty A: ______________________",
    wordCount: 6,
    feedback: null,
    promptTemplateVersion: "nda-v1",
    provider: "openai",
    model: "gpt-5.6",
    providerResponseId: "resp_nda",
  });
  store.selectRevision(project.id, "specification", specification.id);
  store.selectRevision(project.id, "nda", nda.id);
  store.transitionProject(project.id, "generating", "review");
  return { project, specification, nda };
}

it("approves exact revisions and writes an immutable proof package", async () => {
  const store = openTestStore();
  const dataDir = mkdtempSync(join(tmpdir(), "ideaproof-approval-"));
  temporaryDirectories.push(dataDir);
  try {
    const { project, specification, nda } = reviewProject(store);
    const missingConfirmation = await handleApprove({
      projectId: project.id,
      body: {
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
      },
      store,
      dataDir,
    });
    expect(missingConfirmation.status).toBe(400);
    expect(await missingConfirmation.json()).toMatchObject({
      code: "OWNERSHIP_CONFIRMATION_REQUIRED",
    });

    const rendered: Array<Parameters<typeof renderDocumentPdf>[0]> = [];
    const renderPdf: typeof renderDocumentPdf = async (input) => {
      rendered.push(input);
      return renderDocumentPdf(input);
    };
    const response = await handleApprove({
      projectId: project.id,
      body: {
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
        ownershipConfirmed: true,
      },
      store,
      dataDir,
      stamp: async (pdfPath) => {
        writeFileSync(`${pdfPath}.ots`, "proof fixture");
        return { status: "pending", otsPath: `${pdfPath}.ots` };
      },
      now: () => new Date("2026-07-25T00:00:00.000Z"),
      approvalId: "00000000-0000-4000-8000-000000000002",
      renderPdf,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      status: "pending",
      proofUrl: `/projects/${project.id}/proof`,
    });
    const detail = store.getProject(project.id);
    expect(detail.status).toBe("pending");
    expect(detail.approval?.approvedAt).toBe("2026-07-25T00:00:00.000Z");
    expect(isAbsolute(detail.approval!.packagePath)).toBe(false);
    expect(
      detail.proofArtifacts.every(
        (artifact) =>
          !isAbsolute(artifact.pdfPath) &&
          !isAbsolute(artifact.markdownPath) &&
          !isAbsolute(artifact.otsPath),
      ),
    ).toBe(true);
    const zip = unzipSync(
      readFileSync(join(dataDir, detail.approval!.packagePath)),
    );
    const renderedSpecification = rendered.find(
      (document) => document.documentType === "specification",
    );
    expect(renderedSpecification?.markdown).toContain(
      "**Prepared and claimed by:** Private Owner Sentinel",
    );
    expect(
      renderedSpecification?.markdown.match(/Prepared and claimed by/g),
    ).toHaveLength(1);
    expect(strFromU8(zip["technical-specification.md"])).toContain(
      "**Prepared and claimed by:** Private Owner Sentinel",
    );
    expect(
      strFromU8(zip["technical-specification.md"]).match(
        /Prepared and claimed by/g,
      ),
    ).toHaveLength(1);
    expect(Object.keys(zip).sort()).toEqual([
      "manifest.json",
      "sample-nda.md",
      "sample-nda.pdf",
      "sample-nda.pdf.ots",
      "technical-specification.md",
      "technical-specification.pdf",
      "technical-specification.pdf.ots",
    ]);
    expect(JSON.parse(strFromU8(zip["manifest.json"]))).toMatchObject({
      schemaVersion: 2,
      documents: [
        {
          type: "specification",
          provider: "openai",
          model: "gpt-5.6",
        },
        {
          type: "nda",
          markdownFile: "sample-nda.md",
          pdfFile: "sample-nda.pdf",
          proofFile: "sample-nda.pdf.ots",
          provider: "openai",
          model: "gpt-5.6",
        },
      ],
    });

    const duplicate = await handleApprove({
      projectId: project.id,
      body: {
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
      },
      store,
      dataDir,
      stamp: async () => {
        throw new Error("must not run");
      },
    });
    expect(duplicate.status).toBe(409);
  } finally {
    store.closeAndRemove();
  }
});

it("allows a legacy project without an owner name to be approved", async () => {
  const store = openTestStore();
  const dataDir = mkdtempSync(join(tmpdir(), "ideaproof-approval-"));
  temporaryDirectories.push(dataDir);
  try {
    const { project, specification, nda } = reviewProject(store, "");
    const response = await handleApprove({
      projectId: project.id,
      body: {
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
      },
      store,
      dataDir,
      stamp: async (pdfPath) => {
        writeFileSync(`${pdfPath}.ots`, "proof fixture");
        return { status: "pending", otsPath: `${pdfPath}.ots` };
      },
    });

    expect(response.status).toBe(201);
  } finally {
    store.closeAndRemove();
  }
});

it("rejects approval when selected documents predate the latest idea", async () => {
  const store = openTestStore();
  const dataDir = mkdtempSync(join(tmpdir(), "ideaproof-approval-"));
  temporaryDirectories.push(dataDir);
  try {
    const { project, specification, nda } = reviewProject(store);
    store.updateIdea(project.id, {
      ideaName: "IdeaProof Next",
      idea: "A more detailed local app for timestamping exact idea documents.",
    });

    const response = await handleApprove({
      projectId: project.id,
      body: {
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
        ownershipConfirmed: true,
      },
      store,
      dataDir,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "DOCUMENTS_OUTDATED",
      message:
        "Regenerate both documents from the latest idea update before approval.",
    });
  } finally {
    store.closeAndRemove();
  }
});

it("rejects approval when the idea changes during PDF rendering", async () => {
  const store = openTestStore();
  const dataDir = mkdtempSync(join(tmpdir(), "ideaproof-approval-"));
  temporaryDirectories.push(dataDir);
  try {
    const { project, specification, nda } = reviewProject(store);
    let ideaChanged = false;
    const renderPdf: typeof renderDocumentPdf = async (input) => {
      if (!ideaChanged) {
        ideaChanged = true;
        store.updateIdea(project.id, {
          ideaName: "IdeaProof Next",
          idea: "A more detailed local app for timestamping exact idea documents.",
        });
      }
      return renderDocumentPdf(input);
    };

    const response = await handleApprove({
      projectId: project.id,
      body: {
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
        ownershipConfirmed: true,
      },
      store,
      dataDir,
      renderPdf,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "DOCUMENTS_OUTDATED",
    });
    expect(store.getProject(project.id).approval).toBeNull();
  } finally {
    store.closeAndRemove();
  }
});

it("retains rendered artifacts and records a retryable timestamp failure", async () => {
  const store = openTestStore();
  const dataDir = mkdtempSync(join(tmpdir(), "ideaproof-approval-"));
  temporaryDirectories.push(dataDir);
  try {
    const { project, specification, nda } = reviewProject(store);
    const response = await handleApprove({
      projectId: project.id,
      body: {
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
        ownershipConfirmed: true,
      },
      store,
      dataDir,
      stamp: async () => {
        throw new AppError(
          "OTS_CALENDAR_UNAVAILABLE",
          "Calendar unavailable.",
          502,
          true,
        );
      },
      approvalId: "00000000-0000-4000-8000-000000000003",
    });

    expect(response.status).toBe(502);
    const detail = store.getProject(project.id);
    expect(detail.status).toBe("failed");
    expect(detail.proofArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ errorCode: "OTS_CALENDAR_UNAVAILABLE" }),
      ]),
    );
    for (const artifact of detail.proofArtifacts) {
      expect(
        readFileSync(join(dataDir, artifact.pdfPath)).byteLength,
      ).toBeGreaterThan(1_000);
    }

    const hashesBeforeRetry = detail.proofArtifacts.map(
      (artifact) => artifact.sha256,
    );
    const retry = await handleApprove({
      projectId: project.id,
      body: {
        specificationRevisionId: specification.id,
        ndaRevisionId: nda.id,
      },
      store,
      dataDir,
      stamp: async (pdfPath) => {
        writeFileSync(`${pdfPath}.ots`, "retry proof fixture");
        return { status: "pending", otsPath: `${pdfPath}.ots` };
      },
    });

    expect(retry.status).toBe(201);
    const retried = store.getProject(project.id);
    expect(retried.status).toBe("pending");
    expect(retried.proofArtifacts.map((artifact) => artifact.sha256)).toEqual(
      hashesBeforeRetry,
    );
    expect(
      readFileSync(join(dataDir, retried.approval!.packagePath)).byteLength,
    ).toBeGreaterThan(100);
  } finally {
    store.closeAndRemove();
  }
});
