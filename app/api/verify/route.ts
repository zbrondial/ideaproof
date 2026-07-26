import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { loadStorageConfig } from "@/server/config";
import { sha256 } from "@/server/documents/package";
import { AppError } from "@/server/errors";
import { checkProof as verifyProof } from "@/server/proof/ots";
import type { VerificationResult } from "@/server/proof/parse";

const PDF_LIMIT = 10 * 1024 * 1024;
const PROOF_LIMIT = 1024 * 1024;

type Checker = (
  pdfPath: string,
  otsPath: string,
) => Promise<VerificationResult>;

function messageFor(status: VerificationResult["status"]) {
  return {
    confirmed: "The proof confirms these exact PDF bytes.",
    pending: "The proof is valid but is still awaiting confirmation.",
    mismatch: "The proof does not match these PDF bytes.",
    invalid: "The timestamp proof is invalid.",
  }[status];
}

export async function handleVerify(
  request: NextRequest,
  options: {
    tempRoot?: string;
    checkProof?: Checker;
  } = {},
) {
  let temporaryDirectory: string | undefined;
  try {
    const form = await request.formData();
    const entries = [...form.entries()];
    if (
      entries.length !== 2 ||
      entries.map(([key]) => key).sort().join(",") !== "document,proof"
    ) {
      throw new AppError(
        "VERIFY_INPUT_INVALID",
        "Choose exactly one PDF and one .ots proof file.",
        400,
      );
    }
    const document = form.get("document");
    const proof = form.get("proof");
    if (!(document instanceof File) || !(proof instanceof File)) {
      throw new AppError(
        "VERIFY_INPUT_INVALID",
        "Choose exactly one PDF and one .ots proof file.",
        400,
      );
    }
    if (
      !document.name.toLowerCase().endsWith(".pdf") ||
      document.type !== "application/pdf" ||
      !proof.name.toLowerCase().endsWith(".ots")
    ) {
      throw new AppError(
        "VERIFY_FILE_INVALID",
        "Use a PDF document and its matching .ots proof file.",
        400,
      );
    }
    if (document.size > PDF_LIMIT || proof.size > PROOF_LIMIT) {
      throw new AppError(
        "VERIFY_FILE_TOO_LARGE",
        "PDFs must be 10 MB or smaller and proofs must be 1 MB or smaller.",
        413,
      );
    }

    const documentBytes = new Uint8Array(await document.arrayBuffer());
    if (
      documentBytes.length < 5 ||
      new TextDecoder().decode(documentBytes.slice(0, 5)) !== "%PDF-"
    ) {
      throw new AppError(
        "VERIFY_FILE_INVALID",
        "The selected document is not a valid PDF file.",
        400,
      );
    }
    const proofBytes = new Uint8Array(await proof.arrayBuffer());
    const tempRoot =
      options.tempRoot ?? join(loadStorageConfig().dataDir, "verification");
    await mkdir(tempRoot, { recursive: true });
    temporaryDirectory = join(tempRoot, randomUUID());
    await mkdir(temporaryDirectory);
    const pdfPath = join(temporaryDirectory, "document.pdf");
    const proofPath = join(temporaryDirectory, "document.pdf.ots");
    await Promise.all([
      writeFile(pdfPath, documentBytes),
      writeFile(proofPath, proofBytes),
    ]);

    const result = await (options.checkProof ?? verifyProof)(
      pdfPath,
      proofPath,
    );
    return NextResponse.json({
      ...result,
      sha256: sha256(documentBytes),
      message: messageFor(result.status),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        code: "VERIFY_FAILED",
        message: "The files could not be verified.",
      },
      { status: 500 },
    );
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

export function POST(request: NextRequest) {
  return handleVerify(request);
}
