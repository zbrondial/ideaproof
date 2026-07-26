import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { loadStorageConfig } from "@/server/config";

function runVersion(executable: string, args: string[]) {
  return new Promise<string | null>((resolve) => {
    execFile(
      executable,
      args,
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        shell: false,
        timeout: 5_000,
      },
      (error, stdout, stderr) => {
        resolve(error ? null : `${stdout ?? ""}${stderr ?? ""}`.trim());
      },
    );
  });
}

async function defaultDetectPython() {
  for (const command of process.platform === "win32"
    ? ["py", "python"]
    : ["python3", "python"]) {
    const args = command === "py" ? ["-3", "--version"] : ["--version"];
    const output = await runVersion(command, args);
    if (!output) continue;
    const match = output.match(/Python\s+(\d+)\.(\d+)/);
    if (
      match &&
      (Number(match[1]) > 3 ||
        (Number(match[1]) === 3 && Number(match[2]) >= 9))
    ) {
      return output;
    }
  }
  return null;
}

async function defaultDetectOts() {
  const executable =
    process.platform === "win32"
      ? join(
          /* turbopackIgnore: true */ process.cwd(),
          ".venv",
          "Scripts",
          "ots.exe",
        )
      : join(
          /* turbopackIgnore: true */ process.cwd(),
          ".venv",
          "bin",
          "ots",
        );
  return runVersion(executable, ["--version"]);
}

async function defaultCheckDataDirectory() {
  const { dataDir } = loadStorageConfig();
  await mkdir(dataDir, { recursive: true });
  const probe = join(
    /* turbopackIgnore: true */ dataDir,
    `.write-check-${randomUUID()}`,
  );
  try {
    await writeFile(probe, "IdeaProof setup check");
    return true;
  } finally {
    await unlink(probe).catch(() => undefined);
  }
}

export async function handleSetup(
  options: {
    openAiApiKey?: string;
    checkDataDirectory?: () => Promise<boolean>;
    detectPython?: () => string | null | Promise<string | null>;
    detectOts?: () => string | null | Promise<string | null>;
  } = {},
) {
  const hasKey = Boolean(
    (options.openAiApiKey ?? process.env.OPENAI_API_KEY ?? "").trim(),
  );
  let dataDirectoryReady = false;
  try {
    dataDirectoryReady = await (
      options.checkDataDirectory ?? defaultCheckDataDirectory
    )();
  } catch {
    dataDirectoryReady = false;
  }
  const [python, ots] = await Promise.all([
    (options.detectPython ?? defaultDetectPython)(),
    (options.detectOts ?? defaultDetectOts)(),
  ]);
  const checks = [
    hasKey
      ? {
          ok: true,
          code: "SETUP_OPENAI_KEY_READY",
          message: "OpenAI API key is configured.",
        }
      : {
          ok: false,
          code: "SETUP_OPENAI_KEY_MISSING",
          message: "Add OPENAI_API_KEY to .env.",
          command: "cp .env.example .env",
        },
    dataDirectoryReady
      ? {
          ok: true,
          code: "SETUP_DATA_DIR_READY",
          message: "The local data directory is writable.",
        }
      : {
          ok: false,
          code: "SETUP_DATA_DIR_UNWRITABLE",
          message: "The local data directory is not writable.",
          command: "Check IDEAPROOF_DATA_DIR permissions.",
        },
    python
      ? {
          ok: true,
          code: "SETUP_PYTHON_READY",
          message: "Python 3.9 or newer is available.",
        }
      : {
          ok: false,
          code: "SETUP_PYTHON_MISSING",
          message: "Install Python 3.9 or newer.",
          command: "python3 --version",
        },
    ots
      ? {
          ok: true,
          code: "SETUP_OTS_READY",
          message: "OpenTimestamps is installed locally.",
        }
      : {
          ok: false,
          code: "SETUP_OTS_MISSING",
          message: "Install the project-local OpenTimestamps client.",
          command: "npm run setup",
        },
  ];
  return NextResponse.json({
    ready: checks.every((check) => check.ok),
    checks,
  });
}

export function GET() {
  return handleSetup();
}
