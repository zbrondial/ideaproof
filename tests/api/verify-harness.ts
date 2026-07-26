import { NextRequest } from "next/server";

import { handleVerify } from "@/app/api/verify/route";
import type { VerificationResult } from "@/server/proof/parse";

export function fileOfSize(size: number, name: string) {
  const type = name.endsWith(".pdf")
    ? "application/pdf"
    : "application/octet-stream";
  const bytes = new Uint8Array(size);
  if (name.endsWith(".pdf") && size >= 5) {
    bytes.set(new TextEncoder().encode("%PDF-"));
  }
  return new File([bytes], name, { type });
}

export const validFiles = {
  document: fileOfSize(128, "document.pdf"),
  proof: fileOfSize(128, "document.pdf.ots"),
};

export async function verifyMultipart(
  files: { document: File; proof: File },
  options: {
    tempRoot?: string;
    checkProof?: () => Promise<VerificationResult>;
  } = {},
) {
  const form = new FormData();
  form.set("document", files.document);
  form.set("proof", files.proof);
  const request = new NextRequest("http://127.0.0.1:3000/api/verify", {
    method: "POST",
    body: form,
  });
  return handleVerify(request, {
    tempRoot: options.tempRoot,
    checkProof:
      options.checkProof ??
      (async () => ({ status: "pending" as const })),
  });
}
