import { strFromU8, unzipSync } from "fflate";
import { expect, it } from "vitest";

import {
  buildProofPackage,
  sha256,
  type ManifestV1,
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
    "mutual-nda.md": bytes,
    "mutual-nda.pdf": bytes,
    "mutual-nda.pdf.ots": bytes,
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
    "mutual-nda.md",
    "mutual-nda.pdf",
    "mutual-nda.pdf.ots",
    "technical-specification.md",
    "technical-specification.pdf",
    "technical-specification.pdf.ots",
  ]);
  expect(packageBytes).toEqual(buildProofPackage(files, manifest));
  expect(strFromU8(zip["manifest.json"])).not.toContain("OPENAI_API_KEY");
  expect(strFromU8(zip["manifest.json"])).not.toContain("A private user idea");
});
