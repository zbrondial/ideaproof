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

function reviewProject(store: ReturnType<typeof openTestStore>) {
  const project = store.createProject({
    ownerName: "Private Owner Sentinel",
    idea: "A local app that makes concise idea documents and timestamp proofs",
    ndaPurpose: "Discuss a possible product collaboration",
    provider: "openai",
    model: "gpt-5.6",
  });
  store.transitionProject(project.id, "draft", "generating");
  const specification = store.addRevision({
    projectId: project.id,
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
    documentType: "nda",
    content:
      "# Mutual Non-Disclosure Agreement\n\nParty A: ______________________",
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
      "mutual-nda.md",
      "mutual-nda.pdf",
      "mutual-nda.pdf.ots",
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
