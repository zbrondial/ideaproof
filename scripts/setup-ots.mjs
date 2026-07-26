import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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

export function setupOpenTimestamps() {
  const candidates =
    process.platform === "win32"
      ? [
          ["py", ["-3"]],
          ["python", []],
        ]
      : [
          ["python3", []],
          ["python", []],
        ];
  const selected = findPython(candidates);
  if (!selected) {
    process.stderr.write(
      "Python 3.9+ is required. Install Python, then rerun npm run setup.\n",
    );
    return 1;
  }

  const [python, prefix] = selected;
  const venv = join(process.cwd(), ".venv");
  if (!existsSync(venv)) {
    const created = spawnSync(python, [...prefix, "-m", "venv", venv], {
      stdio: "inherit",
    });
    if (created.status !== 0) return created.status ?? 1;
  }

  const venvPython =
    process.platform === "win32"
      ? join(venv, "Scripts", "python.exe")
      : join(venv, "bin", "python");
  const installed = spawnSync(
    venvPython,
    ["-m", "pip", "install", "opentimestamps-client==0.7.2"],
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
