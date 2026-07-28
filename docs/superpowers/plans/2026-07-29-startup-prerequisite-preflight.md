# Startup Prerequisite Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent IdeaProof development and production servers from starting until every core local prerequisite is ready, automatically installing the pinned project-local OpenTimestamps client when needed.

**Architecture:** A synchronous, dependency-injected `scripts/startup-preflight.mjs` module performs version, environment, storage, and OpenTimestamps checks without importing server-only code. npm `predev` and `prestart` lifecycle hooks invoke the same CLI; the existing setup module owns all virtual-environment and pinned-package installation details.

**Tech Stack:** Node.js 24 built-ins, npm lifecycle scripts, Python `venv`/pip, OpenTimestamps client 0.7.2, Vitest 4, Next.js 16.

## Global Constraints

- Require Node.js 24.14 or newer.
- Require npm 10 or newer.
- Require Python 3.9 or newer.
- Require at least one non-empty `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.
- Existing process environment values take precedence over `.env` values, including intentionally blank values.
- Default `IDEAPROOF_DATA_DIR` to `./data`; create it when absent and prove it writable before startup.
- Require project-local `opentimestamps-client==0.7.2`; never install or upgrade global or operating-system packages.
- Never print, hash, interpolate, or return API key values.
- Do not start Next.js after any failed prerequisite.
- Preserve Windows and POSIX support.
- Preserve `npm run setup` as an explicit command.
- Preserve all pre-existing uncommitted proof work and `demo-output/`; never
  stage those paths in startup-preflight commits.

---

### Task 1: Make OpenTimestamps Setup Reusable and Platform-Explicit

**Files:**
- Modify: `scripts/setup-ots.mjs`
- Modify: `scripts/setup-ots.d.mts`
- Modify: `tests/setup-script.test.ts`

**Interfaces:**
- Consumes: Node `spawnSync`, `existsSync`, and platform/root inputs.
- Produces:
  - `OTS_CLIENT_VERSION: "0.7.2"`
  - `resolveOtsExecutable(root?: string, platform?: NodeJS.Platform): string`
  - `resolveVenvPython(root?: string, platform?: NodeJS.Platform): string`
  - `setupOpenTimestamps(options?: SetupOpenTimestampsOptions): number`
- `setupOpenTimestamps()` with no arguments remains the `npm run setup` entry point.

- [ ] **Step 1: Add failing executable-path tests**

Add these cases to `tests/setup-script.test.ts`:

```ts
import {
  OTS_CLIENT_VERSION,
  resolveOtsExecutable,
  resolveVenvPython,
} from "@/scripts/setup-ots.mjs";

it("pins the supported OpenTimestamps client version", () => {
  expect(OTS_CLIENT_VERSION).toBe("0.7.2");
});

it("resolves POSIX virtual-environment executables", () => {
  expect(resolveOtsExecutable("/work/ideaproof", "linux")).toBe(
    "/work/ideaproof/.venv/bin/ots",
  );
  expect(resolveVenvPython("/work/ideaproof", "darwin")).toBe(
    "/work/ideaproof/.venv/bin/python",
  );
});

it("resolves Windows virtual-environment executables", () => {
  expect(resolveOtsExecutable("C:\\work\\ideaproof", "win32")).toBe(
    "C:\\work\\ideaproof\\.venv\\Scripts\\ots.exe",
  );
  expect(resolveVenvPython("C:\\work\\ideaproof", "win32")).toBe(
    "C:\\work\\ideaproof\\.venv\\Scripts\\python.exe",
  );
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npx vitest run tests/setup-script.test.ts --exclude '.worktrees/**'
```

Expected: FAIL because the constants and resolver exports do not exist.

- [ ] **Step 3: Implement the pinned version and path resolvers**

In `scripts/setup-ots.mjs`, add:

```js
import path from "node:path";

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
```

Replace the literal pip requirement with:

```js
`opentimestamps-client==${OTS_CLIENT_VERSION}`
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
npx vitest run tests/setup-script.test.ts --exclude '.worktrees/**'
```

Expected: all setup-script tests PASS.

- [ ] **Step 5: Add a failing dependency-injection test for setup**

Add:

```ts
import { setupOpenTimestamps } from "@/scripts/setup-ots.mjs";

it("creates a missing venv and installs only the pinned local client", () => {
  const run = vi
    .fn()
    .mockReturnValueOnce({ status: 0, stdout: "Python 3.12.4" })
    .mockReturnValueOnce({ status: 0 })
    .mockReturnValueOnce({ status: 0 });

  expect(
    setupOpenTimestamps({
      root: "/work/ideaproof",
      platform: "linux",
      exists: () => false,
      run,
    }),
  ).toBe(0);
  expect(run).toHaveBeenNthCalledWith(
    2,
    "python3",
    ["-m", "venv", "/work/ideaproof/.venv"],
    { stdio: "inherit" },
  );
  expect(run).toHaveBeenNthCalledWith(
    3,
    "/work/ideaproof/.venv/bin/python",
    ["-m", "pip", "install", "opentimestamps-client==0.7.2"],
    { stdio: "inherit" },
  );
});
```

- [ ] **Step 6: Run the new test and confirm RED**

Run:

```bash
npx vitest run tests/setup-script.test.ts --exclude '.worktrees/**'
```

Expected: FAIL because `setupOpenTimestamps` does not accept injected root,
platform, existence, and process-runner dependencies.

- [ ] **Step 7: Add setup options without changing CLI behavior**

Implement:

```js
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
  const paths = platformPath(platform);
  const venv = paths.join(root, ".venv");
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
```

Update `scripts/setup-ots.d.mts` with:

```ts
export const OTS_CLIENT_VERSION: "0.7.2";

export type SetupOpenTimestampsOptions = {
  root?: string;
  platform?: NodeJS.Platform;
  exists?: (path: string) => boolean;
  run?: PythonVersionRunner;
};

export type SetupProcessOptions =
  | { encoding: "utf8" }
  | { stdio: "inherit" };

export function resolveOtsExecutable(
  root?: string,
  platform?: NodeJS.Platform,
): string;

export function resolveVenvPython(
  root?: string,
  platform?: NodeJS.Platform,
): string;

export function setupOpenTimestamps(
  options?: SetupOpenTimestampsOptions,
): number;
```

Change `PythonVersionRunner`'s `options` parameter to
`SetupProcessOptions`.

- [ ] **Step 8: Verify Task 1**

Run:

```bash
npx vitest run tests/setup-script.test.ts --exclude '.worktrees/**'
npx eslint scripts/setup-ots.mjs tests/setup-script.test.ts
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit Task 1**

```bash
git add scripts/setup-ots.mjs scripts/setup-ots.d.mts tests/setup-script.test.ts
git commit -m "refactor: make timestamp setup reusable"
```

---

### Task 2: Build the Startup Preflight Engine

**Files:**
- Create: `scripts/startup-preflight.mjs`
- Create: `scripts/startup-preflight.d.mts`
- Create: `tests/startup-preflight.test.ts`

**Interfaces:**
- Consumes:
  - `OTS_CLIENT_VERSION`, `resolveOtsExecutable`, and
    `setupOpenTimestamps(options)` from Task 1.
  - `.env` file content and inherited `NodeJS.ProcessEnv`.
- Produces:
  - `meetsMinimumVersion(output, minimumMajor, minimumMinor): boolean`
  - `loadPreflightEnvironment(root, inheritedEnv, dependencies?): NodeJS.ProcessEnv`
  - `checkWritableDataDirectory(root, env, dependencies?): string`
  - `runStartupPreflight(options?): PreflightResult`
  - `formatPreflightResult(result): string`
- `PreflightResult` is:

```ts
type PreflightResult =
  | { ok: true; messages: string[] }
  | {
      ok: false;
      errors: Array<{
        code: string;
        message: string;
        remediation: string;
      }>;
    };
```

- [ ] **Step 1: Write failing version and environment tests**

Create `tests/startup-preflight.test.ts` with:

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import {
  loadPreflightEnvironment,
  meetsMinimumVersion,
} from "@/scripts/startup-preflight.mjs";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "ideaproof-preflight-"));
  roots.push(root);
  return root;
}

it.each([
  ["v24.14.0", 24, 14, true],
  ["v24.13.9", 24, 14, false],
  ["v25.0.0", 24, 14, true],
  ["10.0.0", 10, 0, true],
  ["9.9.9", 10, 0, false],
] as const)(
  "checks version %s against %d.%d",
  (output, major, minor, expected) => {
    expect(meetsMinimumVersion(output, major, minor)).toBe(expected);
  },
);

it("loads .env while preserving inherited environment precedence", () => {
  const root = tempRoot();
  writeFileSync(
    join(root, ".env"),
    [
      "OPENAI_API_KEY=file-openai-key",
      "ANTHROPIC_API_KEY=file-anthropic-key",
      "IDEAPROOF_DATA_DIR=./stored-data",
    ].join("\n"),
  );

  const env = loadPreflightEnvironment(root, {
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "process-anthropic-key",
  });

  expect(env).toMatchObject({
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "process-anthropic-key",
    IDEAPROOF_DATA_DIR: "./stored-data",
  });
});

it("allows a missing .env when inherited configuration is complete", () => {
  const root = tempRoot();
  expect(
    loadPreflightEnvironment(root, {
      OPENAI_API_KEY: "process-openai-key",
    }).OPENAI_API_KEY,
  ).toBe("process-openai-key");
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npx vitest run tests/startup-preflight.test.ts --exclude '.worktrees/**'
```

Expected: FAIL because `scripts/startup-preflight.mjs` does not exist.

- [ ] **Step 3: Implement version and environment helpers**

Create `scripts/startup-preflight.mjs` with:

```js
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  OTS_CLIENT_VERSION,
  findPython,
  resolveOtsExecutable,
  setupOpenTimestamps,
} from "./setup-ots.mjs";

export function meetsMinimumVersion(output, minimumMajor, minimumMinor) {
  const match = /v?(\d+)\.(\d+)/.exec(output ?? "");
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > minimumMajor || (major === minimumMajor && minor >= minimumMinor);
}

export function loadPreflightEnvironment(
  root,
  inheritedEnv = process.env,
  dependencies = {},
) {
  const exists = dependencies.exists ?? existsSync;
  const read = dependencies.read ?? readFileSync;
  const envPath = path.join(root, ".env");
  const fileEnv = exists(envPath)
    ? parseEnv(read(envPath, "utf8"))
    : {};
  return { ...fileEnv, ...inheritedEnv };
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
npx vitest run tests/startup-preflight.test.ts --exclude '.worktrees/**'
```

Expected: version and environment tests PASS.

- [ ] **Step 5: Add failing storage tests**

Add:

```ts
import { checkWritableDataDirectory } from "@/scripts/startup-preflight.mjs";

it("creates and checks the default local data directory", () => {
  const root = tempRoot();
  expect(checkWritableDataDirectory(root, {})).toBe(join(root, "data"));
});

it("resolves and checks a custom data directory", () => {
  const root = tempRoot();
  expect(
    checkWritableDataDirectory(root, {
      IDEAPROOF_DATA_DIR: "./private-data",
    }),
  ).toBe(join(root, "private-data"));
});

it("rejects an unusable data-directory path", () => {
  const root = tempRoot();
  const filePath = join(root, "not-a-directory");
  writeFileSync(filePath, "occupied");
  expect(() =>
    checkWritableDataDirectory(root, { IDEAPROOF_DATA_DIR: filePath }),
  ).toThrow();
});
```

- [ ] **Step 6: Run the storage tests and confirm RED**

Run:

```bash
npx vitest run tests/startup-preflight.test.ts --exclude '.worktrees/**'
```

Expected: FAIL because `checkWritableDataDirectory` does not exist.

- [ ] **Step 7: Implement the writable-directory probe**

Add:

```js
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
      // The original write or directory error remains the actionable failure.
    }
  }
  return dataDir;
}
```

- [ ] **Step 8: Run the storage tests and confirm GREEN**

Run:

```bash
npx vitest run tests/startup-preflight.test.ts --exclude '.worktrees/**'
```

Expected: all helper tests PASS.

- [ ] **Step 9: Add failing orchestration tests**

Define a passing fixture:

```ts
function passingOptions() {
  return {
    root: "/work/ideaproof",
    platform: "linux" as const,
    nodeVersion: "v24.14.0",
    inheritedEnv: { OPENAI_API_KEY: "private-test-key" },
    loadEnvironment: () => ({ OPENAI_API_KEY: "private-test-key" }),
    detectNpm: () => "10.8.2",
    detectPython: () => ["python3", []] as [string, string[]],
    checkDataDirectory: () => "/work/ideaproof/data",
    detectOts: () => "v0.7.2",
    setupOts: () => 0,
  };
}
```

Add:

```ts
import { vi } from "vitest";
import { runStartupPreflight } from "@/scripts/startup-preflight.mjs";

it("passes without installation when every prerequisite is ready", () => {
  const setupOts = vi.fn(() => 0);
  expect(runStartupPreflight({ ...passingOptions(), setupOts })).toEqual({
    ok: true,
    messages: expect.arrayContaining([
      "Node.js v24.14.0",
      "npm 10.8.2",
      "Python is available",
      "At least one AI provider is configured",
      "Local data directory is writable",
      "OpenTimestamps v0.7.2",
    ]),
  });
  expect(setupOts).not.toHaveBeenCalled();
});

it.each([
  [
    "old Node",
    { nodeVersion: "v24.13.9" },
    "STARTUP_NODE_UNSUPPORTED",
  ],
  ["old npm", { detectNpm: () => "9.9.9" }, "STARTUP_NPM_UNSUPPORTED"],
  ["missing Python", { detectPython: () => null }, "STARTUP_PYTHON_MISSING"],
  [
    "missing provider",
    { loadEnvironment: () => ({}) },
    "STARTUP_PROVIDER_MISSING",
  ],
] as const)("fails before startup for %s", (_name, override, code) => {
  const result = runStartupPreflight({ ...passingOptions(), ...override });
  expect(result).toMatchObject({
    ok: false,
    errors: expect.arrayContaining([expect.objectContaining({ code })]),
  });
  expect(JSON.stringify(result)).not.toContain("private-test-key");
});

it("installs a missing client and requires the final version check", () => {
  const setupOts = vi.fn(() => 0);
  const detectOts = vi
    .fn()
    .mockReturnValueOnce(null)
    .mockReturnValueOnce("v0.7.2");
  expect(
    runStartupPreflight({
      ...passingOptions(),
      detectOts,
      setupOts,
    }),
  ).toMatchObject({ ok: true });
  expect(setupOts).toHaveBeenCalledTimes(1);
  expect(detectOts).toHaveBeenCalledTimes(2);
});

it("fails when installation does not produce the pinned executable", () => {
  const result = runStartupPreflight({
    ...passingOptions(),
    detectOts: () => null,
    setupOts: () => 1,
  });
  expect(result).toMatchObject({
    ok: false,
    errors: expect.arrayContaining([
      expect.objectContaining({ code: "STARTUP_OTS_INSTALL_FAILED" }),
    ]),
  });
});
```

- [ ] **Step 10: Run orchestration tests and confirm RED**

Run:

```bash
npx vitest run tests/startup-preflight.test.ts --exclude '.worktrees/**'
```

Expected: FAIL because `runStartupPreflight` does not exist.

- [ ] **Step 11: Implement prerequisite orchestration**

Implement `runStartupPreflight(options = {})` with these exact behaviors:

```js
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
    ((selectedRoot, env) => checkWritableDataDirectory(selectedRoot, env));
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
```

Ensure error formatting never serializes `env`.

- [ ] **Step 12: Add the formatter, CLI entry point, and declarations**

Add:

```js
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
```

Create `scripts/startup-preflight.d.mts` defining every exported function,
`PreflightResult`, and optional dependency callback used in tests. Use
`NodeJS.ProcessEnv` for environment inputs and `NodeJS.Platform` for platform
inputs.

- [ ] **Step 13: Add secret-output and formatter assertions**

Add:

```ts
import { formatPreflightResult } from "@/scripts/startup-preflight.mjs";

it("formats actionable failures without environment values", () => {
  const result = runStartupPreflight({
    ...passingOptions(),
    loadEnvironment: () => ({
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      UNRELATED_SECRET: "must-not-appear",
    }),
  });
  const output = formatPreflightResult(result);
  expect(output).toContain("STARTUP_PROVIDER_MISSING");
  expect(output).toContain("Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env.");
  expect(output).not.toContain("must-not-appear");
});
```

- [ ] **Step 14: Verify Task 2**

Run:

```bash
npx vitest run tests/startup-preflight.test.ts tests/setup-script.test.ts --exclude '.worktrees/**'
npx eslint scripts/startup-preflight.mjs tests/startup-preflight.test.ts
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 15: Commit Task 2**

```bash
git add scripts/startup-preflight.mjs scripts/startup-preflight.d.mts tests/startup-preflight.test.ts
git commit -m "feat: validate prerequisites before startup"
```

---

### Task 3: Wire npm Startup and Prove the Server Is Gated

**Files:**
- Modify: `package.json`
- Modify: `scripts/smoke-start.mjs`
- Create: `scripts/smoke-preflight-failure.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: `node scripts/startup-preflight.mjs` from Task 2.
- Produces npm scripts:
  - `preflight`
  - `predev`
  - `prestart`
  - `smoke:preflight`
- `npm run dev` and `npm start` become gated without changing their Next.js
  command bodies.

- [ ] **Step 1: Add lifecycle hooks and smoke command**

Modify `package.json`:

```json
{
  "scripts": {
    "setup": "node scripts/setup-ots.mjs",
    "preflight": "node scripts/startup-preflight.mjs",
    "predev": "npm run preflight",
    "dev": "next dev --hostname 127.0.0.1",
    "build": "next build",
    "prestart": "npm run preflight",
    "start": "next start --hostname 127.0.0.1 --port 3000",
    "smoke": "node scripts/smoke-start.mjs",
    "smoke:preflight": "node scripts/smoke-preflight-failure.mjs"
  }
}
```

Keep all existing lint, typecheck, test, E2E, and verify scripts unchanged.

- [ ] **Step 2: Run preflight with deliberately missing keys**

Run:

```bash
OPENAI_API_KEY= ANTHROPIC_API_KEY= npm run preflight
```

Expected: exit 1, include `STARTUP_PROVIDER_MISSING`, and omit all secret
values.

- [ ] **Step 3: Run preflight with a fixture key**

Run:

```bash
OPENAI_API_KEY=smoke-fixture-key ANTHROPIC_API_KEY= npm run preflight
```

Expected: exit 0 and report Node, npm, Python, data directory, and
OpenTimestamps readiness without printing `smoke-fixture-key`.

- [ ] **Step 4: Create the failed-start smoke script**

Create `scripts/smoke-preflight-failure.mjs`:

```js
import { spawn } from "node:child_process";

const port = process.env.IDEAPROOF_PREFLIGHT_SMOKE_PORT ?? "3199";
const child = spawn("npm", ["start", "--", "--port", port], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    IDEAPROOF_DATA_DIR:
      process.env.IDEAPROOF_DATA_DIR ?? "./data",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});

const deadline = Date.now() + 15_000;
while (child.exitCode === null && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

if (child.exitCode === null) {
  child.kill("SIGTERM");
  throw new Error("IdeaProof started despite missing provider keys.");
}
if (!output.includes("STARTUP_PROVIDER_MISSING")) {
  throw new Error(`Expected the provider preflight failure.\n${output}`);
}
if (output.includes("next start")) {
  throw new Error(`Next.js started after a failed preflight.\n${output}`);
}

process.stdout.write(
  "IdeaProof stopped before Next.js when provider configuration was missing\n",
);
```

- [ ] **Step 5: Run the failed-start smoke test**

Run:

```bash
npm run smoke:preflight
```

Expected: exit 0 with:

```text
IdeaProof stopped before Next.js when provider configuration was missing
```

- [ ] **Step 6: Keep the successful smoke path explicit**

In `scripts/smoke-start.mjs`, fail immediately unless the spawned child has a
fixture provider key:

```js
const smokeEnv = {
  ...process.env,
  OPENAI_API_KEY:
    process.env.OPENAI_API_KEY?.trim() || "smoke-fixture-key",
  IDEAPROOF_DATA_DIR:
    process.env.IDEAPROOF_DATA_DIR ?? "./data",
};
```

Use `env: smokeEnv` in `spawn`. This key remains local to the smoke process and
is never sent because the smoke test requests only the home and setup routes.

- [ ] **Step 7: Build and run the successful startup smoke**

Run:

```bash
npm run build
IDEAPROOF_SMOKE_PORT=3101 npm run smoke
```

Expected: exit 0 with:

```text
IdeaProof home and setup checks responded with 200
```

- [ ] **Step 8: Update install and troubleshooting documentation**

Update `README.md` so the primary flow removes the explicit `npm run setup`
step:

```bash
npm install
npm run build
npm start
```

Add this startup behavior:

```markdown
Before development or production startup, IdeaProof checks Node.js, npm,
Python, provider configuration, local data-directory access, and the
project-local OpenTimestamps client. The first successful start creates
`.venv` and installs the pinned OpenTimestamps client when needed.

Startup stops with an actionable error if a machine prerequisite or provider
key is missing. Automatic OpenTimestamps installation requires package-index
network access once; later starts use the existing local executable and work
without reinstalling it.
```

Update the no-provider section to state that startup now refuses to launch
instead of entering verification-only mode. Keep the Setup page description as
a diagnostic view for a successfully started app.

- [ ] **Step 9: Verify Task 3**

Run:

```bash
npx eslint scripts/smoke-start.mjs scripts/smoke-preflight-failure.mjs
npm run typecheck
npm run smoke:preflight
IDEAPROOF_SMOKE_PORT=3101 npm run smoke
```

Expected: all commands exit 0.

- [ ] **Step 10: Commit Task 3**

```bash
git add package.json scripts/smoke-start.mjs scripts/smoke-preflight-failure.mjs README.md
git commit -m "feat: gate webapp startup on prerequisites"
```

Before committing, inspect `git diff --cached --name-only` and confirm none of
the pre-existing proof implementation files or `demo-output/` are staged.

---

### Task 4: Full Regression and Live Setup Verification

**Files:**
- Modify only if required by a failing regression:
  - `scripts/startup-preflight.mjs`
  - `scripts/startup-preflight.d.mts`
  - `scripts/setup-ots.mjs`
  - `scripts/setup-ots.d.mts`
  - `tests/startup-preflight.test.ts`
  - `tests/setup-script.test.ts`
  - `scripts/smoke-start.mjs`
  - `scripts/smoke-preflight-failure.mjs`
  - `README.md`

**Interfaces:**
- Consumes the complete startup contract from Tasks 1–3.
- Produces fresh evidence that the repository and live setup flow are ready.

- [ ] **Step 1: Run all unit and API tests**

Run:

```bash
npx vitest run --exclude '.worktrees/**'
```

Expected: all test files PASS with zero failed tests.

- [ ] **Step 2: Run static verification**

Run:

```bash
npx eslint scripts/setup-ots.mjs scripts/startup-preflight.mjs scripts/smoke-start.mjs scripts/smoke-preflight-failure.mjs tests/setup-script.test.ts tests/startup-preflight.test.ts
npm run typecheck
git diff --check
```

Expected: all commands exit 0 with no lint, type, or whitespace errors.

- [ ] **Step 3: Run both startup smoke paths**

Run:

```bash
npm run build
npm run smoke:preflight
IDEAPROOF_SMOKE_PORT=3101 npm run smoke
```

Expected: the failed-prerequisite smoke proves Next.js never starts; the valid
smoke receives HTTP 200 from `/` and `/api/setup`.

- [ ] **Step 4: Verify development startup**

Run:

```bash
OPENAI_API_KEY=smoke-fixture-key npm run dev
```

Expected: preflight reports every prerequisite ready, then Next.js listens on
`http://127.0.0.1:3000`.

- [ ] **Step 5: Verify the live Setup page**

Open:

```text
http://127.0.0.1:3000/setup
```

Confirm:

- the page has meaningful content;
- there is no Next.js error overlay;
- there are no browser console errors;
- Python is reported ready;
- the local data directory is reported writable;
- OpenTimestamps is reported installed locally.

- [ ] **Step 6: Review final scope**

Run:

```bash
git status --short
git diff --stat HEAD~3..HEAD
```

Confirm the startup work does not alter document generation, proof creation,
proof verification, database schema, or user data.

- [ ] **Step 7: Commit any verification-only correction**

If Step 1–6 required a correction, stage only the files listed in this task
and commit:

```bash
git add scripts/setup-ots.mjs scripts/setup-ots.d.mts scripts/startup-preflight.mjs scripts/startup-preflight.d.mts tests/setup-script.test.ts tests/startup-preflight.test.ts scripts/smoke-start.mjs scripts/smoke-preflight-failure.mjs README.md package.json
git commit -m "fix: complete startup preflight verification"
```

If no correction was required, do not create an empty commit.
