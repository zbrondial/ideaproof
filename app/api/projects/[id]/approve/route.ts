import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { loadStorageConfig } from "@/server/config";
import {
  getProjectStore,
  type DocumentType,
  type ProjectDetail,
} from "@/server/db/projects";
import {
  buildProofPackage,
  sha256,
  type ManifestV2,
} from "@/server/documents/package";
import { renderPdf as renderDocumentPdf } from "@/server/documents/pdf";
import { AppError } from "@/server/errors";
import { stampPdf } from "@/server/proof/ots";
import { e2eFixturesEnabled } from "@/server/runtime-mode";

const approvalInput = z
  .object({
    specificationRevisionId: z.uuid(),
    ndaRevisionId: z.uuid(),
  })
  .strict();

type Store = ReturnType<typeof getProjectStore>;
type Stamp = typeof stampPdf;

function dataPath(dataDir: string, storedPath: string) {
  return isAbsolute(storedPath) ? storedPath : join(dataDir, storedPath);
}

async function packageApprovedProject(
  project: ProjectDetail,
  dataDir: string,
) {
  if (!project.approval) {
    throw new AppError("APPROVAL_NOT_FOUND", "Approval not found.", 404);
  }
  const specification = project.revisions.find(
    (revision) =>
      revision.id === project.approval!.specificationRevisionId,
  );
  const nda = project.revisions.find(
    (revision) => revision.id === project.approval!.ndaRevisionId,
  );
  const specificationArtifact = project.proofArtifacts.find(
    (artifact) => artifact.documentType === "specification",
  );
  const ndaArtifact = project.proofArtifacts.find(
    (artifact) => artifact.documentType === "nda",
  );
  if (!specification || !nda || !specificationArtifact || !ndaArtifact) {
    throw new AppError(
      "APPROVAL_ARTIFACTS_INVALID",
      "The approved artifacts are incomplete.",
      500,
    );
  }
  const [specificationPdf, specificationProof, ndaPdf, ndaProof] =
    await Promise.all([
      readFile(dataPath(dataDir, specificationArtifact.pdfPath)),
      readFile(dataPath(dataDir, specificationArtifact.otsPath)),
      readFile(dataPath(dataDir, ndaArtifact.pdfPath)),
      readFile(dataPath(dataDir, ndaArtifact.otsPath)),
    ]);
  const manifest: ManifestV2 = {
    schemaVersion: 2,
    projectId: project.id,
    approvalId: project.approval.id,
    approvedAt: project.approval.approvedAt,
    documents: [
      {
        type: "specification",
        revisionId: specification.id,
        markdownFile: "technical-specification.md",
        pdfFile: "technical-specification.pdf",
        proofFile: "technical-specification.pdf.ots",
        sha256: specificationArtifact.sha256,
        wordCount: specification.wordCount,
        promptTemplateVersion: specification.promptTemplateVersion,
        provider: specification.provider,
        model: specification.model,
      },
      {
        type: "nda",
        revisionId: nda.id,
        markdownFile: "mutual-nda.md",
        pdfFile: "mutual-nda.pdf",
        proofFile: "mutual-nda.pdf.ots",
        sha256: ndaArtifact.sha256,
        wordCount: nda.wordCount,
        promptTemplateVersion: nda.promptTemplateVersion,
        provider: nda.provider,
        model: nda.model,
      },
    ],
  };
  return buildProofPackage(
    {
      "technical-specification.md": new TextEncoder().encode(
        specification.content,
      ),
      "technical-specification.pdf": specificationPdf,
      "technical-specification.pdf.ots": specificationProof,
      "mutual-nda.md": new TextEncoder().encode(nda.content),
      "mutual-nda.pdf": ndaPdf,
      "mutual-nda.pdf.ots": ndaProof,
    },
    manifest,
  );
}

function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { code: error.code, message: error.message, retryable: error.retryable },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      code: "APPROVAL_FAILED",
      message: "The proof package could not be created.",
      retryable: true,
    },
    { status: 500 },
  );
}

export async function handleApprove({
  projectId,
  body,
  store,
  dataDir,
  stamp = stampPdf,
  now = () => new Date(),
  approvalId = randomUUID(),
}: {
  projectId: string;
  body: unknown;
  store: Store;
  dataDir: string;
  stamp?: Stamp;
  now?: () => Date;
  approvalId?: string;
}) {
  let createdApprovalId: string | undefined;
  try {
    const input = approvalInput.parse(body);
    const project = store.getProject(projectId);
    if (project.approval) {
      if (project.status !== "failed") {
        throw new AppError(
          "APPROVAL_EXISTS",
          "This project is already approved.",
          409,
        );
      }
      if (
        project.approval.specificationRevisionId !==
          input.specificationRevisionId ||
        project.approval.ndaRevisionId !== input.ndaRevisionId
      ) {
        throw new AppError(
          "APPROVAL_IMMUTABLE",
          "A timestamp retry must use the originally approved revisions.",
          409,
        );
      }

      const retryArtifacts = project.proofArtifacts.filter(
        (artifact) => artifact.status === "failed",
      );
      const retryResults = await Promise.allSettled(
        retryArtifacts.map((artifact) =>
          stamp(dataPath(dataDir, artifact.pdfPath)),
        ),
      );
      const rejected = retryResults.findIndex(
        (result) => result.status === "rejected",
      );
      for (const [index, artifact] of retryArtifacts.entries()) {
        const result = retryResults[index];
        if (result.status === "fulfilled") {
          store.updateProofArtifact(
            project.approval.id,
            artifact.documentType,
            { status: "pending" },
          );
        } else {
          store.updateProofArtifact(
            project.approval.id,
            artifact.documentType,
            {
              status: "failed",
              errorCode:
                result.reason instanceof AppError
                  ? result.reason.code
                  : "OTS_PROCESS_FAILED",
            },
          );
        }
      }
      if (rejected !== -1) {
        const failure = retryResults[rejected];
        throw failure.status === "rejected"
          ? failure.reason
          : new AppError(
              "OTS_PROCESS_FAILED",
              "Timestamping failed.",
              502,
              true,
            );
      }

      const packageBytes = await packageApprovedProject(
        store.getProject(projectId),
        dataDir,
      );
      const packagePath = dataPath(dataDir, project.approval.packagePath);
      const temporaryPackage = `${packagePath}.tmp`;
      await writeFile(temporaryPackage, packageBytes);
      await rename(temporaryPackage, packagePath);
      store.transitionProject(projectId, "failed", "pending");
      return NextResponse.json(
        { status: "pending", proofUrl: `/projects/${projectId}/proof` },
        { status: 201 },
      );
    }
    if (project.status !== "review") {
      throw new AppError(
        "PROJECT_STATE_INVALID",
        "This project is not ready for approval.",
        409,
      );
    }

    const specification = project.revisions.find(
      (revision) =>
        revision.id === input.specificationRevisionId &&
        revision.documentType === "specification",
    );
    const nda = project.revisions.find(
      (revision) =>
        revision.id === input.ndaRevisionId &&
        revision.documentType === "nda",
    );
    if (!specification || !nda) {
      throw new AppError(
        "REVISION_PROJECT_MISMATCH",
        "Approval revisions must belong to this project.",
        409,
      );
    }
    if (specification.wordCount > 1_000 || nda.wordCount > 700) {
      throw new AppError(
        "DOCUMENT_TOO_LONG",
        "A selected document exceeds its word limit.",
        409,
      );
    }

    const approvedAt = now().toISOString();
    const relativeDirectory = join("approvals", projectId, approvalId);
    const artifactDirectory = join(dataDir, relativeDirectory);
    await mkdir(artifactDirectory, { recursive: true });

    const storedPaths = {
      specification: {
        markdown: join(relativeDirectory, "technical-specification.md"),
        pdf: join(relativeDirectory, "technical-specification.pdf"),
        ots: join(relativeDirectory, "technical-specification.pdf.ots"),
      },
      nda: {
        markdown: join(relativeDirectory, "mutual-nda.md"),
        pdf: join(relativeDirectory, "mutual-nda.pdf"),
        ots: join(relativeDirectory, "mutual-nda.pdf.ots"),
      },
      package: join(relativeDirectory, "ideaproof-package.zip"),
    };
    const paths = {
      specification: {
        markdown: join(artifactDirectory, "technical-specification.md"),
        pdf: join(artifactDirectory, "technical-specification.pdf"),
        ots: join(artifactDirectory, "technical-specification.pdf.ots"),
      },
      nda: {
        markdown: join(artifactDirectory, "mutual-nda.md"),
        pdf: join(artifactDirectory, "mutual-nda.pdf"),
        ots: join(artifactDirectory, "mutual-nda.pdf.ots"),
      },
      package: join(artifactDirectory, "ideaproof-package.zip"),
    };

    const [specificationPdf, ndaPdf] = await Promise.all([
      renderDocumentPdf({
        title: "Technical Specification",
        markdown: specification.content,
        approvedAt,
        documentType: "specification",
      }),
      renderDocumentPdf({
        title: "Mutual Non-Disclosure Agreement",
        markdown: nda.content,
        approvedAt,
        documentType: "nda",
      }),
    ]);
    await Promise.all([
      writeFile(paths.specification.markdown, specification.content),
      writeFile(paths.specification.pdf, specificationPdf),
      writeFile(paths.nda.markdown, nda.content),
      writeFile(paths.nda.pdf, ndaPdf),
    ]);

    const approval = store.createApproval({
      approvalId,
      approvedAt,
      projectId,
      specificationRevisionId: specification.id,
      ndaRevisionId: nda.id,
      packagePath: storedPaths.package,
      artifacts: [
        {
          documentType: "specification",
          pdfPath: storedPaths.specification.pdf,
          markdownPath: storedPaths.specification.markdown,
          otsPath: storedPaths.specification.ots,
          sha256: sha256(specificationPdf),
        },
        {
          documentType: "nda",
          pdfPath: storedPaths.nda.pdf,
          markdownPath: storedPaths.nda.markdown,
          otsPath: storedPaths.nda.ots,
          sha256: sha256(ndaPdf),
        },
      ],
    });
    createdApprovalId = approval.id;

    const stampTargets = [
      ["specification", paths.specification.pdf],
      ["nda", paths.nda.pdf],
    ] as const satisfies ReadonlyArray<readonly [DocumentType, string]>;
    const stampResults = await Promise.allSettled(
      stampTargets.map(([, pdfPath]) => stamp(pdfPath)),
    );
    const failed = stampResults.findIndex(
      (result) => result.status === "rejected",
    );
    if (failed !== -1) {
      for (const [index, [documentType]] of stampTargets.entries()) {
        const result = stampResults[index];
        if (result.status === "rejected") {
          const code =
            result.reason instanceof AppError
              ? result.reason.code
              : "OTS_PROCESS_FAILED";
          store.updateProofArtifact(approval.id, documentType, {
            status: "failed",
            errorCode: code,
          });
        }
      }
      store.transitionProject(projectId, "review", "failed");
      throw stampResults[failed].status === "rejected"
        ? stampResults[failed].reason
        : new AppError("OTS_PROCESS_FAILED", "Timestamping failed.", 502, true);
    }

    const packageBytes = await packageApprovedProject(
      store.getProject(projectId),
      dataDir,
    );
    const temporaryPackage = `${paths.package}.tmp`;
    await writeFile(temporaryPackage, packageBytes);
    await rename(temporaryPackage, paths.package);
    store.transitionProject(projectId, "review", "pending");

    return NextResponse.json(
      { status: "pending", proofUrl: `/projects/${projectId}/proof` },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "APPROVAL_INPUT_INVALID",
          message: "Choose one valid revision for each document.",
        },
        { status: 400 },
      );
    }
    if (createdApprovalId) {
      const current = store.getProject(projectId);
      if (current.status === "review") {
        store.transitionProject(projectId, "review", "failed");
      }
    }
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fixtureStamp = e2eFixturesEnabled()
      ? (await import("@/tests/fixtures/openai-responses")).fixtureStampPdf
      : undefined;
    return handleApprove({
      projectId: id,
      body: await request.json(),
      store: getProjectStore(),
      dataDir: loadStorageConfig().dataDir,
      stamp: fixtureStamp,
    });
  } catch {
    return NextResponse.json(
      {
        code: "APPROVAL_INPUT_INVALID",
        message: "Choose one valid revision for each document.",
      },
      { status: 400 },
    );
  }
}
