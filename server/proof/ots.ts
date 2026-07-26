import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { AppError } from "@/server/errors";

import { parseOtsOutput, type VerificationResult } from "./parse";

export type ProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ProcessRunner = (
  executable: string,
  args: string[],
  options: {
    shell: false;
    timeout: number;
    maxBuffer: number;
    cwd: string;
  },
) => Promise<ProcessResult>;

const processOptions = (cwd: string) => ({
  shell: false as const,
  timeout: 60_000,
  maxBuffer: 1024 * 1024,
  cwd,
});

const runProcess: ProcessRunner = (executable, args, options) =>
  new Promise((resolve, reject) => {
    execFile(executable, args, options, (error, stdout, stderr) => {
      if (error && (error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
        reject(error);
        return;
      }
      resolve({
        exitCode:
          typeof (error as { code?: unknown } | null)?.code === "number"
            ? ((error as { code: number }).code ?? 1)
            : error
              ? 1
              : 0,
        stdout,
        stderr,
      });
    });
  });

export function resolveOtsExecutable(root = process.cwd()): string {
  return process.platform === "win32"
    ? join(root, ".venv", "Scripts", "ots.exe")
    : join(root, ".venv", "bin", "ots");
}

function executableFor(runner: ProcessRunner) {
  const executable = resolveOtsExecutable();
  if (runner === runProcess && !existsSync(executable)) {
    throw new AppError(
      "SETUP_OTS_MISSING",
      "OpenTimestamps is not installed. Run npm run setup.",
      503,
    );
  }
  return executable;
}

function mapProcessError(error: unknown): never {
  if ((error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") {
    throw new AppError(
      "OTS_TIMEOUT",
      "OpenTimestamps did not finish in time. Try again.",
      504,
      true,
    );
  }
  throw new AppError(
    "OTS_PROCESS_FAILED",
    "OpenTimestamps could not be run.",
    502,
    true,
  );
}

export async function stampPdf(
  pdfPath: string,
  runner: ProcessRunner = runProcess,
): Promise<{ status: "pending"; otsPath: string }> {
  try {
    const result = await runner(
      executableFor(runner),
      ["stamp", pdfPath],
      processOptions(dirname(pdfPath)),
    );
    if (result.exitCode !== 0) {
      throw new AppError(
        "OTS_CALENDAR_UNAVAILABLE",
        "The timestamp calendar is unavailable. Try again.",
        502,
        true,
      );
    }
    return { status: "pending", otsPath: `${pdfPath}.ots` };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return mapProcessError(error);
  }
}

export async function checkProof(
  pdfPath: string,
  otsPath: string,
  runner: ProcessRunner = runProcess,
): Promise<VerificationResult> {
  try {
    const executable = executableFor(runner);
    await runner(
      executable,
      ["upgrade", otsPath],
      processOptions(dirname(otsPath)),
    );
    const verified = await runner(
      executable,
      ["verify", otsPath],
      processOptions(dirname(pdfPath)),
    );
    const output = `${verified.stdout}\n${verified.stderr}`;
    const parsed = parseOtsOutput(output);
    const expectedNonzero =
      parsed.status === "mismatch" ||
      parsed.status === "invalid" ||
      (parsed.status === "pending" &&
        /pending|not yet|incomplete|calendar/i.test(output));
    if (verified.exitCode !== 0 && !expectedNonzero) {
      throw new AppError(
        "OTS_VERIFY_FAILED",
        "The timestamp proof could not be verified.",
        502,
        true,
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return mapProcessError(error);
  }
}
