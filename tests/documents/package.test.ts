import { strFromU8, unzipSync } from "fflate";
import { expect, it } from "vitest";

import {
  buildProofPackage,
  sha256,
  type ManifestV1,
  type ManifestV2,
} from "@/server/documents/package";

it("hashes exact bytes", () => {
  expect(sha256(new TextEncoder().encode("fixture"))).toBe(
    "f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d",
  );
});

it("packages only approved public artifacts", () => {
  const bytes = new TextEncoder().encode("fixture");
  const files = {
    "technical-specification.md": bytes,
    "technical-specification.pdf": bytes,
    "technical-specification.pdf.ots": bytes,
    "sample-nda.md": bytes,
    "sample-nda.pdf": bytes,
    "sample-nda.pdf.ots": bytes,
  };
  const manifest: ManifestV1 = {
    schemaVersion: 1,
    projectId: "00000000-0000-4000-8000-000000000001",
    approvalId: "00000000-0000-4000-8000-000000000002",
    approvedAt: "2026-07-25T00:00:00.000Z",
    documents: [],
  };
  const packageBytes = buildProofPackage(files, manifest);
  const zip = unzipSync(packageBytes);

  expect(Object.keys(zip).sort()).toEqual([
    "manifest.json",
    "sample-nda.md",
    "sample-nda.pdf",
    "sample-nda.pdf.ots",
    "technical-specification.md",
    "technical-specification.pdf",
    "technical-specification.pdf.ots",
  ]);
  expect(packageBytes).toEqual(buildProofPackage(files, manifest));
  expect(strFromU8(zip["manifest.json"])).not.toContain("OPENAI_API_KEY");
  expect(strFromU8(zip["manifest.json"])).not.toContain("A private user idea");
});

it("records the selected provider and model in version 2 manifests", () => {
  const bytes = new TextEncoder().encode("fixture");
  const files = {
    "technical-specification.md": bytes,
    "technical-specification.pdf": bytes,
    "technical-specification.pdf.ots": bytes,
    "sample-nda.md": bytes,
    "sample-nda.pdf": bytes,
    "sample-nda.pdf.ots": bytes,
  };
  const manifest: ManifestV2 = {
    schemaVersion: 2,
    projectId: "00000000-0000-4000-8000-000000000001",
    approvalId: "00000000-0000-4000-8000-000000000002",
    approvedAt: "2026-07-25T00:00:00.000Z",
    documents: [
      {
        type: "specification",
        revisionId: "00000000-0000-4000-8000-000000000003",
        markdownFile: "technical-specification.md",
        pdfFile: "technical-specification.pdf",
        proofFile: "technical-specification.pdf.ots",
        sha256: "f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d",
        wordCount: 1,
        promptTemplateVersion: "spec-v2",
        provider: "anthropic",
        model: "claude-opus-4-8",
      },
    ],
  };

  const zip = unzipSync(buildProofPackage(files, manifest));
  expect(JSON.parse(strFromU8(zip["manifest.json"]))).toMatchObject({
    schemaVersion: 2,
    documents: [
      {
        provider: "anthropic",
        model: "claude-opus-4-8",
      },
    ],
  });
});
