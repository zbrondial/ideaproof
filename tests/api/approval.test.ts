import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

import { unzipSync } from "fflate";
import { afterEach, expect, it } from "vitest";

import { handleApprove } from "@/app/api/projects/[id]/approve/route";
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
    idea: "A local app that makes concise idea documents and timestamp proofs",
    ndaPurpose: "Discuss a possible product collaboration",
  });
  store.transitionProject(project.id, "draft", "generating");
  const specification = store.addRevision({
    projectId: project.id,
    documentType: "specification",
    content: "# Technical Specification\n\nA concise implementation.",
    wordCount: 5,
    feedback: null,
    promptTemplateVersion: "spec-v1",
    model: "gpt-5.6",
    openaiResponseId: "resp_spec",
  });
  const nda = store.addRevision({
    projectId: project.id,
    documentType: "nda",
    content:
      "# Mutual Non-Disclosure Agreement\n\nParty A: ______________________",
    wordCount: 6,
    feedback: null,
    promptTemplateVersion: "nda-v1",
    model: "gpt-5.6",
    openaiResponseId: "resp_nda",
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
    expect(Object.keys(zip).sort()).toEqual([
      "manifest.json",
      "mutual-nda.md",
      "mutual-nda.pdf",
      "mutual-nda.pdf.ots",
      "technical-specification.md",
      "technical-specification.pdf",
      "technical-specification.pdf.ots",
    ]);

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
