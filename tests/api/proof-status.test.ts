import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { handlePackage } from "@/app/api/ideas/[id]/package/route";
import { handleProofCheck } from "@/app/api/ideas/[id]/proof/check/route";
import { AppError } from "@/server/errors";

import { openTestStore } from "../helpers/open-test-store";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function pendingProject(store: ReturnType<typeof openTestStore>) {
  const project = store.createProject({
    ideaName: "IdeaProof",
    idea: "A local app that verifies timestamped idea documents",
    ndaPurpose: "Discuss a possible collaboration",
    provider: "openai",
    model: "gpt-5.6",
  });
  store.transitionProject(project.id, "draft", "generating");
  const add = (documentType: "specification" | "nda") =>
    store.addRevision({
      projectId: project.id,
      ideaVersionId: project.currentIdeaVersionId,
      documentType,
      content: `# ${documentType}`,
      wordCount: 1,
      feedback: null,
      promptTemplateVersion: `${documentType}-v1`,
      provider: "openai",
      model: "gpt-5.6",
      providerResponseId: null,
    });
  const specification = add("specification");
  const nda = add("nda");
  store.transitionProject(project.id, "generating", "review");
  const directory = mkdtempSync(join(tmpdir(), "ideaproof-proof-"));
  temporaryDirectories.push(directory);
  const packagePath = join(directory, "proof.zip");
  writeFileSync(packagePath, "immutable zip");
  const approval = store.createApproval({
    projectId: project.id,
    specificationRevisionId: specification.id,
    ndaRevisionId: nda.id,
    packagePath,
    artifacts: [
      {
        documentType: "specification",
        pdfPath: join(directory, "spec.pdf"),
        markdownPath: join(directory, "spec.md"),
        otsPath: join(directory, "spec.pdf.ots"),
        sha256: "a".repeat(64),
      },
      {
        documentType: "nda",
        pdfPath: join(directory, "nda.pdf"),
        markdownPath: join(directory, "nda.md"),
        otsPath: join(directory, "nda.pdf.ots"),
        sha256: "b".repeat(64),
      },
    ],
  });
  store.transitionProject(project.id, "review", "pending");
  return { project, approval };
}

it("confirms a project only after both document proofs confirm", async () => {
  const store = openTestStore();
  try {
    const { project } = pendingProject(store);
    const checker = vi.fn().mockResolvedValue({
      status: "confirmed",
      verificationMethod: "bitcoin-core",
      bitcoinBlockHeight: 900000,
      confirmedAt: "2026-07-25",
    });
    const response = await handleProofCheck({
      projectId: project.id,
      store,
      check: checker,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "confirmed" });
    expect(checker).toHaveBeenCalledTimes(2);
    expect(store.getProject(project.id).status).toBe("confirmed");
  } finally {
    store.closeAndRemove();
  }
});

it("keeps the project pending while either proof is pending", async () => {
  const store = openTestStore();
  try {
    const { project } = pendingProject(store);
    const checker = vi
      .fn()
      .mockResolvedValueOnce({
        status: "confirmed",
        verificationMethod: "bitcoin-core",
        bitcoinBlockHeight: 900000,
        confirmedAt: "2026-07-25",
      })
      .mockResolvedValueOnce({ status: "pending" });
    const response = await handleProofCheck({
      projectId: project.id,
      store,
      check: checker,
    });

    expect(await response.json()).toMatchObject({ status: "pending" });
    expect(store.getProject(project.id).status).toBe("pending");
  } finally {
    store.closeAndRemove();
  }
});

it("upgrades embedded attestations when Bitcoin Core later becomes available", async () => {
  const store = openTestStore();
  try {
    const { project } = pendingProject(store);
    const embeddedChecker = vi.fn().mockResolvedValue({
      status: "confirmed",
      verificationMethod: "embedded-attestation",
      bitcoinBlockHeight: 900000,
    });
    await handleProofCheck({
      projectId: project.id,
      store,
      check: embeddedChecker,
    });

    expect(
      store
        .getProject(project.id)
        .proofArtifacts.every(
          (artifact) =>
            artifact.status === "confirmed" && artifact.confirmedAt === null,
        ),
    ).toBe(true);

    const bitcoinCoreChecker = vi.fn().mockResolvedValue({
      status: "confirmed",
      verificationMethod: "bitcoin-core",
      bitcoinBlockHeight: 900000,
      confirmedAt: "2026-07-25",
    });
    await handleProofCheck({
      projectId: project.id,
      store,
      check: bitcoinCoreChecker,
    });

    expect(bitcoinCoreChecker).toHaveBeenCalledTimes(2);
    expect(
      store
        .getProject(project.id)
        .proofArtifacts.every(
          (artifact) => artifact.confirmedAt === "2026-07-25",
        ),
    ).toBe(true);
  } finally {
    store.closeAndRemove();
  }
});

it.each([
  ["a pending recheck", () => Promise.resolve({ status: "pending" as const })],
  [
    "a retryable recheck error",
    () =>
      Promise.reject(
        new AppError(
          "OTS_TIMEOUT",
          "OpenTimestamps did not finish in time.",
          504,
          true,
        ),
      ),
  ],
])("preserves embedded attestations after %s", async (_case, recheck) => {
  const store = openTestStore();
  try {
    const { project } = pendingProject(store);
    await handleProofCheck({
      projectId: project.id,
      store,
      check: vi.fn().mockResolvedValue({
        status: "confirmed",
        verificationMethod: "embedded-attestation",
        bitcoinBlockHeight: 900000,
      }),
    });

    const response = await handleProofCheck({
      projectId: project.id,
      store,
      check: vi.fn(recheck),
    });

    expect(await response.json()).toMatchObject({
      status: "confirmed",
      artifacts: [
        {
          status: "confirmed",
          verificationMethod: "embedded-attestation",
        },
        {
          status: "confirmed",
          verificationMethod: "embedded-attestation",
        },
      ],
    });
    expect(
      store
        .getProject(project.id)
        .proofArtifacts.every(
          (artifact) =>
            artifact.status === "confirmed" &&
            artifact.confirmedAt === null &&
            artifact.errorCode === null,
        ),
    ).toBe(true);
  } finally {
    store.closeAndRemove();
  }
});

it("marks a completed timestamp as failed after a definitive mismatch", async () => {
  const store = openTestStore();
  try {
    const { project } = pendingProject(store);
    await handleProofCheck({
      projectId: project.id,
      store,
      check: vi.fn().mockResolvedValue({
        status: "confirmed",
        verificationMethod: "embedded-attestation",
        bitcoinBlockHeight: 900000,
      }),
    });

    const response = await handleProofCheck({
      projectId: project.id,
      store,
      check: vi.fn().mockResolvedValue({ status: "mismatch" }),
    });

    expect(await response.json()).toMatchObject({
      status: "failed",
      artifacts: [
        { status: "failed", errorCode: "OTS_DIGEST_MISMATCH" },
        { status: "failed", errorCode: "OTS_DIGEST_MISMATCH" },
      ],
    });
    expect(store.getProject(project.id).status).toBe("failed");
  } finally {
    store.closeAndRemove();
  }
});

it("downloads the existing immutable ZIP with safe headers", async () => {
  const store = openTestStore();
  try {
    const { project } = pendingProject(store);
    const response = await handlePackage(project.id, store);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="[a-z0-9-]+\.zip"$/,
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "immutable zip",
    );
  } finally {
    store.closeAndRemove();
  }
});
