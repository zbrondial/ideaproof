import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import {
  checkProof,
  resolveOtsExecutable,
  stampPdf,
} from "@/server/proof/ots";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

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

it("reuses an existing proof instead of trying to stamp it again", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ideaproof-ots-"));
  temporaryDirectories.push(directory);
  const pdfPath = join(directory, "document.pdf");
  writeFileSync(pdfPath, "approved PDF");
  writeFileSync(`${pdfPath}.ots`, "existing proof");
  const fakeRunner = vi.fn();

  await expect(stampPdf(pdfPath, fakeRunner)).resolves.toEqual({
    status: "pending",
    otsPath: `${pdfPath}.ots`,
  });
  expect(fakeRunner).not.toHaveBeenCalled();
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
    verificationMethod: "bitcoin-core",
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

it("keeps an upgraded proof pending when Bitcoin Core is unavailable", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ideaproof-ots-"));
  temporaryDirectories.push(directory);
  const pdfPath = join(directory, "document.pdf");
  writeFileSync(pdfPath, "approved PDF");
  const fakeRunner = vi
    .fn()
    .mockResolvedValueOnce({
      exitCode: 0,
      stdout: "Success! Timestamp complete",
      stderr: "",
    })
    .mockResolvedValueOnce({
      exitCode: 1,
      stdout: "",
      stderr:
        "Could not connect to local Bitcoin node: [Errno 61] Connection refused",
    })
    .mockResolvedValueOnce({
      exitCode: 0,
      stdout:
        "File sha256 hash: 4c9fa23c61d37c19588c4b8736dde1a483b5ea81c18e05dab55ea8d55d003255\nTimestamp:\nverify PendingAttestation('https://calendar.example')",
      stderr: "",
    });

  await expect(
    checkProof(pdfPath, `${pdfPath}.ots`, fakeRunner),
  ).resolves.toEqual({ status: "pending" });
});

it("confirms a matching upgraded proof from its embedded Bitcoin attestation when Bitcoin Core is unavailable", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ideaproof-ots-"));
  temporaryDirectories.push(directory);
  const pdfPath = join(directory, "document.pdf");
  writeFileSync(pdfPath, "approved PDF");
  const fakeRunner = vi
    .fn()
    .mockResolvedValueOnce({
      exitCode: 0,
      stdout: "Success! Timestamp complete",
      stderr: "",
    })
    .mockResolvedValueOnce({
      exitCode: 1,
      stdout: "",
      stderr:
        "Could not connect to Bitcoin node: Cookie file unusable and rpcpassword not specified",
    })
    .mockResolvedValueOnce({
      exitCode: 0,
      stdout:
        "File sha256 hash: 4c9fa23c61d37c19588c4b8736dde1a483b5ea81c18e05dab55ea8d55d003255\nTimestamp:\nverify BitcoinBlockHeaderAttestation(959810)",
      stderr: "",
    });

  await expect(
    checkProof(pdfPath, `${pdfPath}.ots`, fakeRunner),
  ).resolves.toEqual({
    status: "confirmed",
    verificationMethod: "embedded-attestation",
    bitcoinBlockHeight: 959810,
  });
  expect(fakeRunner).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining("ots"),
    ["info", `${pdfPath}.ots`],
    expect.objectContaining({ shell: false }),
  );
});
