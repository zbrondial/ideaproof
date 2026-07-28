import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

import {
  OTS_CLIENT_VERSION,
  findPython,
  resolveOtsExecutable,
  setupOpenTimestamps,
} from "./setup-ots.mjs";

export function meetsMinimumVersion(
  output,
  minimumMajor,
  minimumMinor,
) {
  const match = /v?(\d+)\.(\d+)/.exec(output ?? "");
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return (
    major > minimumMajor ||
    (major === minimumMajor && minor >= minimumMinor)
  );
}

export function loadPreflightEnvironment(
  root,
  inheritedEnv = process.env,
  dependencies = {},
) {
  const exists = dependencies.exists ?? existsSync;
  const read = dependencies.read ?? readFileSync;
  const unsupportedEnvFiles = [
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
    ".env.production.local",
    ".env.test",
    ".env.test.local",
  ];
  const unsupportedEnvFile = unsupportedEnvFiles.find((file) =>
    exists(path.join(root, file)),
  );
  if (unsupportedEnvFile) {
    throw new Error(`Unsupported environment file ${unsupportedEnvFile}`);
  }
  const envPath = path.join(root, ".env");
  let fileEnv = {};
  if (exists(envPath)) {
    const contents = read(envPath, "utf8");
    for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
      const line = index === 0 ? rawLine.replace(/^\uFEFF/, "") : rawLine;
      if (!line.trim() || /^\s*#/.test(line)) continue;
      if (!/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)) {
        throw new Error(`Invalid .env entry on line ${index + 1}`);
      }
    }
    fileEnv = parseEnv(contents);
    if (
      Object.values(fileEnv).some(
        (value) => value && /(^|[^\\])\$/.test(value),
      )
    ) {
      throw new Error("Variable expansion is not supported in .env");
    }
  }
  return { ...fileEnv, ...inheritedEnv };
}

export function checkWritableDataDirectory(
  root,
  env,
  dependencies = {},
) {
  const mkdir = dependencies.mkdir ?? mkdirSync;
  const write = dependencies.write ?? writeFileSync;
  const unlink = dependencies.unlink ?? unlinkSync;
  const configured = env.IDEAPROOF_DATA_DIR?.trim();
  const dataDir = configured
    ? path.resolve(root, configured)
    : path.join(root, "data");
  mkdir(dataDir, { recursive: true });
  const probe = path.join(dataDir, `.preflight-${randomUUID()}`);
  try {
    write(probe, "IdeaProof startup preflight");
  } finally {
    try {
      unlink(probe);
    } catch {
      // Preserve the original write or directory error.
    }
  }
  return dataDir;
}

export function runStartupPreflight(options = {}) {
  const root = options.root ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const run = options.run ?? spawnSync;
  const nodeVersion = options.nodeVersion ?? process.version;
  const inheritedEnv = options.inheritedEnv ?? process.env;
  const loadEnvironment =
    options.loadEnvironment ??
    ((selectedRoot, selectedEnv) =>
      loadPreflightEnvironment(selectedRoot, selectedEnv));
  const detectNpm =
    options.detectNpm ??
    (() => {
      const command = platform === "win32" ? "npm.cmd" : "npm";
      const result = run(command, ["--version"], { encoding: "utf8" });
      return result.status === 0
        ? `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
        : null;
    });
  const detectPython =
    options.detectPython ??
    (() =>
      findPython(
        platform === "win32"
          ? [
              ["py", ["-3"]],
              ["python", []],
            ]
          : [
              ["python3", []],
              ["python", []],
            ],
        run,
      ));
  const checkDataDirectory =
    options.checkDataDirectory ??
    ((selectedRoot, env) =>
      checkWritableDataDirectory(selectedRoot, env));
  const detectOts =
    options.detectOts ??
    (() => {
      const result = run(
        resolveOtsExecutable(root, platform),
        ["--version"],
        { encoding: "utf8" },
      );
      return result.status === 0
        ? `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
        : null;
    });
  const setupOts =
    options.setupOts ??
    (() => setupOpenTimestamps({ root, platform, run }));

  const errors = [];
  const messages = [];
  const addError = (code, message, remediation) => {
    errors.push({ code, message, remediation });
  };

  if (!meetsMinimumVersion(nodeVersion, 24, 14)) {
    addError(
      "STARTUP_NODE_UNSUPPORTED",
      `Node.js ${nodeVersion} is unsupported; IdeaProof requires 24.14 or newer.`,
      "Install Node.js 24.14+ and rerun the command.",
    );
  } else {
    messages.push(`Node.js ${nodeVersion}`);
  }

  const npmVersion = detectNpm();
  if (!npmVersion || !meetsMinimumVersion(npmVersion, 10, 0)) {
    addError(
      "STARTUP_NPM_UNSUPPORTED",
      `npm ${npmVersion ?? "was not found"}; IdeaProof requires npm 10 or newer.`,
      "Install npm 10+ and rerun the command.",
    );
  } else {
    messages.push(`npm ${npmVersion}`);
  }

  const python = detectPython();
  if (!python) {
    addError(
      "STARTUP_PYTHON_MISSING",
      "Python 3.9 or newer was not found.",
      "Install Python 3.9+ and rerun the command.",
    );
  } else {
    messages.push("Python is available");
  }

  let env;
  try {
    env = loadEnvironment(root, inheritedEnv);
  } catch {
    addError(
      "STARTUP_ENV_INVALID",
      "The local .env file could not be read or parsed.",
      "Copy .env.example to .env and correct its key=value entries.",
    );
  }

  if (
    env &&
    !env.OPENAI_API_KEY?.trim() &&
    !env.ANTHROPIC_API_KEY?.trim()
  ) {
    addError(
      "STARTUP_PROVIDER_MISSING",
      "At least one AI provider API key is required.",
      "Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env.",
    );
  } else if (env) {
    messages.push("At least one AI provider is configured");
  }

  if (env) {
    try {
      checkDataDirectory(root, env);
      messages.push("Local data directory is writable");
    } catch {
      addError(
        "STARTUP_DATA_DIR_UNWRITABLE",
        "The configured local data directory is not writable.",
        "Correct IDEAPROOF_DATA_DIR or its directory permissions.",
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  let otsVersion = detectOts();
  if (otsVersion !== `v${OTS_CLIENT_VERSION}`) {
    const installStatus = setupOts();
    otsVersion = installStatus === 0 ? detectOts() : null;
  }
  if (otsVersion !== `v${OTS_CLIENT_VERSION}`) {
    return {
      ok: false,
      errors: [
        {
          code: "STARTUP_OTS_INSTALL_FAILED",
          message: `OpenTimestamps v${OTS_CLIENT_VERSION} could not be installed locally.`,
          remediation:
            "Check Python package-index access, then run npm run setup.",
        },
      ],
    };
  }

  messages.push(`OpenTimestamps ${otsVersion}`);
  return { ok: true, messages };
}

export function formatPreflightResult(result) {
  if (result.ok) {
    return [
      "IdeaProof startup prerequisites are ready:",
      ...result.messages.map((message) => `  ✓ ${message}`),
    ].join("\n");
  }
  return [
    "IdeaProof cannot start:",
    ...result.errors.flatMap((error) => [
      `  ✗ [${error.code}] ${error.message}`,
      `    ${error.remediation}`,
    ]),
  ].join("\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = runStartupPreflight();
  const output = `${formatPreflightResult(result)}\n`;
  (result.ok ? process.stdout : process.stderr).write(output);
  process.exit(result.ok ? 0 : 1);
}
