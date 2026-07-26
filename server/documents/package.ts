import { createHash } from "node:crypto";

import { strToU8, zipSync, type Zippable } from "fflate";

import type { AiProvider } from "@/server/config";

type ManifestDocument = {
  type: "specification" | "nda";
  revisionId: string;
  markdownFile: string;
  pdfFile: string;
  proofFile: string;
  sha256: string;
  wordCount: number;
  promptTemplateVersion: string;
  model: string;
};

export type ManifestV1 = {
  schemaVersion: 1;
  projectId: string;
  approvalId: string;
  approvedAt: string;
  documents: ManifestDocument[];
};

export type ManifestV2 = {
  schemaVersion: 2;
  projectId: string;
  approvalId: string;
  approvedAt: string;
  documents: Array<ManifestDocument & { provider: AiProvider }>;
};

export type ProofManifest = ManifestV1 | ManifestV2;

const publicFiles = [
  "technical-specification.md",
  "technical-specification.pdf",
  "technical-specification.pdf.ots",
  "sample-nda.md",
  "sample-nda.pdf",
  "sample-nda.pdf.ots",
] as const;

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildProofPackage(
  files: Record<(typeof publicFiles)[number], Uint8Array>,
  manifest: ProofManifest,
): Uint8Array {
  const modified = new Date(manifest.approvedAt);
  const entries: Zippable = {};
  for (const filename of publicFiles) {
    entries[filename] = [files[filename], { mtime: modified }];
  }
  entries["manifest.json"] = [
    strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
    { mtime: modified },
  ];
  return zipSync(entries, { level: 6 });
}
