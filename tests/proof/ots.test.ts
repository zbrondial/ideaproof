import { expect, it, vi } from "vitest";

import {
  checkProof,
  resolveOtsExecutable,
  stampPdf,
} from "@/server/proof/ots";

it("resolves the executable inside the project-local virtual environment", () => {
  expect(resolveOtsExecutable("/work/ideaproof")).toContain(
    process.platform === "win32"
      ? ".venv\\Scripts\\ots.exe"
      : ".venv/bin/ots",
  );
});

it("passes paths as arguments without a shell", async () => {
  const fakeRunner = vi.fn().mockResolvedValue({
    exitCode: 0,
    stdout: "Submitting to remote calendar",
    stderr: "",
  });
  await stampPdf("/tmp/project/file with spaces.pdf", fakeRunner);
  expect(fakeRunner).toHaveBeenCalledWith(
    expect.stringContaining("ots"),
    ["stamp", "/tmp/project/file with spaces.pdf"],
    expect.objectContaining({ shell: false }),
  );
});

it("upgrades then verifies an existing proof", async () => {
  const fakeRunner = vi
    .fn()
    .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce({
      exitCode: 0,
      stdout:
        "Success! Bitcoin block 900000 attests existence as of 2026-07-25 UTC",
      stderr: "",
    });

  await expect(
    checkProof(
      "/tmp/project/document.pdf",
      "/tmp/project/document.pdf.ots",
      fakeRunner,
    ),
  ).resolves.toMatchObject({
    status: "confirmed",
    bitcoinBlockHeight: 900000,
  });
  expect(fakeRunner).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining("ots"),
    ["upgrade", "/tmp/project/document.pdf.ots"],
    expect.objectContaining({ shell: false }),
  );
  expect(fakeRunner).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining("ots"),
    ["verify", "/tmp/project/document.pdf.ots"],
    expect.objectContaining({ shell: false }),
  );
});

it("maps a timed-out process to a stable retryable error", async () => {
  const fakeRunner = vi.fn().mockRejectedValue(
    Object.assign(new Error("timed out"), {
      code: "ETIMEDOUT",
    }),
  );

  await expect(stampPdf("/tmp/document.pdf", fakeRunner)).rejects.toMatchObject({
    code: "OTS_TIMEOUT",
    retryable: true,
  });
});

it("rejects an unknown nonzero verification result", async () => {
  const fakeRunner = vi
    .fn()
    .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce({
      exitCode: 1,
      stdout: "",
      stderr: "unexpected client failure",
    });

  await expect(
    checkProof("/tmp/document.pdf", "/tmp/document.pdf.ots", fakeRunner),
  ).rejects.toMatchObject({
    code: "OTS_VERIFY_FAILED",
    retryable: true,
  });
});
