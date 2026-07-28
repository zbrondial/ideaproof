import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const OTS_CLIENT_VERSION = "0.7.2";

function platformPath(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

export function resolveOtsExecutable(
  root = process.cwd(),
  platform = process.platform,
) {
  const paths = platformPath(platform);
  return platform === "win32"
    ? paths.join(root, ".venv", "Scripts", "ots.exe")
    : paths.join(root, ".venv", "bin", "ots");
}

export function resolveVenvPython(
  root = process.cwd(),
  platform = process.platform,
) {
  const paths = platformPath(platform);
  return platform === "win32"
    ? paths.join(root, ".venv", "Scripts", "python.exe")
    : paths.join(root, ".venv", "bin", "python");
}

function supportsPython(versionOutput) {
  const match = /Python\s+(\d+)\.(\d+)/.exec(versionOutput);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 3 || (major === 3 && minor >= 9);
}

export function findPython(candidates, run = spawnSync) {
  for (const [command, prefix] of candidates) {
    const result = run(command, [...prefix, "--version"], {
      encoding: "utf8",
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (result.status === 0 && supportsPython(output)) {
      return [command, prefix];
    }
  }
  return null;
}

export function setupOpenTimestamps(options = {}) {
  const root = options.root ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const run = options.run ?? spawnSync;
  const exists = options.exists ?? existsSync;
  const candidates =
    platform === "win32"
      ? [
          ["py", ["-3"]],
          ["python", []],
        ]
      : [
          ["python3", []],
          ["python", []],
        ];
  const selected = findPython(candidates, run);
  if (!selected) {
    process.stderr.write(
      "Python 3.9+ is required. Install Python, then rerun npm run setup.\n",
    );
    return 1;
  }

  const [python, prefix] = selected;
  const venv = platformPath(platform).join(root, ".venv");
  if (!exists(venv)) {
    const created = run(python, [...prefix, "-m", "venv", venv], {
      stdio: "inherit",
    });
    if (created.status !== 0) return created.status ?? 1;
  }

  const installed = run(
    resolveVenvPython(root, platform),
    [
      "-m",
      "pip",
      "install",
      `opentimestamps-client==${OTS_CLIENT_VERSION}`,
    ],
    { stdio: "inherit" },
  );
  return installed.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(setupOpenTimestamps());
}
