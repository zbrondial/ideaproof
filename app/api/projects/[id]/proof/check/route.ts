import { NextResponse } from "next/server";

import { getProjectStore } from "@/server/db/projects";
import { AppError } from "@/server/errors";
import {
  checkProof,
  type ProcessRunner,
} from "@/server/proof/ots";

type Store = ReturnType<typeof getProjectStore>;
type Check = (
  pdfPath: string,
  otsPath: string,
  runner?: ProcessRunner,
) => ReturnType<typeof checkProof>;

function safeError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { code: error.code, message: error.message, retryable: error.retryable },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      code: "OTS_VERIFY_FAILED",
      message: "The timestamp proofs could not be checked.",
      retryable: true,
    },
    { status: 502 },
  );
}

export async function handleProofCheck({
  projectId,
  store,
  check = checkProof,
}: {
  projectId: string;
  store: Store;
  check?: Check;
}) {
  try {
    const project = store.getProject(projectId);
    if (!project.approval || project.proofArtifacts.length !== 2) {
      throw new AppError(
        "APPROVAL_NOT_FOUND",
        "This project does not have timestamp proofs yet.",
        404,
      );
    }

    const checks = await Promise.allSettled(
      project.proofArtifacts.map(async (artifact) => {
        if (artifact.status === "confirmed") return;
        const result = await check(artifact.pdfPath, artifact.otsPath);
        if (result.status === "confirmed") {
          store.updateProofArtifact(
            project.approval!.id,
            artifact.documentType,
            {
              status: "confirmed",
              bitcoinBlockHeight: result.bitcoinBlockHeight,
              confirmedAt: result.confirmedAt,
            },
          );
        } else if (result.status === "pending") {
          store.updateProofArtifact(
            project.approval!.id,
            artifact.documentType,
            { status: "pending" },
          );
        } else {
          store.updateProofArtifact(
            project.approval!.id,
            artifact.documentType,
            {
              status: "failed",
              errorCode:
                result.status === "mismatch"
                  ? "OTS_DIGEST_MISMATCH"
                  : "OTS_PROOF_INVALID",
            },
          );
        }
      }),
    );

    for (const [index, result] of checks.entries()) {
      if (result.status === "rejected") {
        const artifact = project.proofArtifacts[index];
        const code =
          result.reason instanceof AppError
            ? result.reason.code
            : "OTS_VERIFY_FAILED";
        store.updateProofArtifact(
          project.approval.id,
          artifact.documentType,
          { status: "failed", errorCode: code },
        );
      }
    }

    const updated = store.getProject(projectId);
    const allConfirmed = updated.proofArtifacts.every(
      (artifact) => artifact.status === "confirmed",
    );
    const anyFailed = updated.proofArtifacts.some(
      (artifact) => artifact.status === "failed",
    );
    if (allConfirmed && updated.status === "pending") {
      store.transitionProject(projectId, "pending", "confirmed");
    } else if (allConfirmed && updated.status === "failed") {
      store.transitionProject(projectId, "failed", "pending");
      store.transitionProject(projectId, "pending", "confirmed");
    } else if (anyFailed && updated.status === "pending") {
      store.transitionProject(projectId, "pending", "failed");
    } else if (!anyFailed && updated.status === "failed") {
      store.transitionProject(projectId, "failed", "pending");
    }

    const final = store.getProject(projectId);
    return NextResponse.json({
      status: final.status,
      artifacts: final.proofArtifacts.map((artifact) => ({
        documentType: artifact.documentType,
        status: artifact.status,
        sha256: artifact.sha256,
        bitcoinBlockHeight: artifact.bitcoinBlockHeight,
        confirmedAt: artifact.confirmedAt,
        errorCode: artifact.errorCode,
      })),
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleProofCheck({ projectId: id, store: getProjectStore() });
}
