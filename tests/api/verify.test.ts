import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { fileOfSize, validFiles, verifyMultipart } from "./verify-harness";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it("rejects oversized files before invoking ots", async () => {
  const otsRunner = vi.fn();
  const response = await verifyMultipart(
    {
      document: fileOfSize(10 * 1024 * 1024 + 1, "document.pdf"),
      proof: fileOfSize(100, "document.pdf.ots"),
    },
    { checkProof: otsRunner },
  );
  expect(response.status).toBe(413);
  expect(otsRunner).not.toHaveBeenCalled();
});

it("uses fixed generated filenames and removes temporary files", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "ideaproof-verify-test-"));
  roots.push(tempRoot);
  const checker = vi
    .fn()
    .mockResolvedValue({ status: "pending" as const });
  const response = await verifyMultipart(validFiles, {
    tempRoot,
    checkProof: checker,
  });

  expect(response.status).toBe(200);
  expect(checker).toHaveBeenCalledWith(
    expect.stringMatching(/document\.pdf$/),
    expect.stringMatching(/document\.pdf\.ots$/),
  );
  expect(await readdir(tempRoot)).toEqual([]);
});

it.each([
  ["confirmed", "confirmed"],
  ["pending", "pending"],
  ["mismatch", "mismatch"],
  ["invalid", "invalid"],
] as const)("returns a safe %s verification result", async (status, expected) => {
  const response = await verifyMultipart(validFiles, {
    checkProof: async () =>
      status === "confirmed"
        ? {
            status,
            bitcoinBlockHeight: 900000,
            confirmedAt: "2026-07-25",
          }
        : { status },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    status: expected,
    sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});

it("describes an embedded Bitcoin attestation without claiming node verification", async () => {
  const response = await verifyMultipart(validFiles, {
    checkProof: async () => ({
      status: "confirmed",
      bitcoinBlockHeight: 959810,
    }),
  });

  expect(await response.json()).toMatchObject({
    status: "confirmed",
    message:
      "The proof matches these exact PDF bytes and contains a Bitcoin block attestation.",
  });
});

it("rejects disguised PDF uploads", async () => {
  const response = await verifyMultipart({
    document: new File([new Uint8Array(12)], "document.txt", {
      type: "text/plain",
    }),
    proof: validFiles.proof,
  });

  expect(response.status).toBe(400);
});
