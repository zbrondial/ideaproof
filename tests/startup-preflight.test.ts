import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import {
  checkWritableDataDirectory,
  formatPreflightResult,
  loadPreflightEnvironment,
  meetsMinimumVersion,
  runStartupPreflight,
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

it("rejects malformed non-comment lines in an existing .env", () => {
  const root = tempRoot();
  writeFileSync(
    join(root, ".env"),
    "OPENAI_API_KEY=valid-value\nBROKEN_LINE\n",
  );

  expect(() => loadPreflightEnvironment(root, {})).toThrow(
    "Invalid .env entry on line 2",
  );
});

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

it("passes without installation when every prerequisite is ready", () => {
  const setupOts = vi.fn(() => 0);
  expect(runStartupPreflight({ ...passingOptions(), setupOts })).toEqual({
    ok: true,
    messages: [
      "Node.js v24.14.0",
      "npm 10.8.2",
      "Python is available",
      "At least one AI provider is configured",
      "Local data directory is writable",
      "OpenTimestamps v0.7.2",
    ],
  });
  expect(setupOts).not.toHaveBeenCalled();
});

it("accepts Anthropic as the only configured provider", () => {
  const result = runStartupPreflight({
    ...passingOptions(),
    loadEnvironment: () => ({
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "private-anthropic-key",
    }),
  });
  expect(result).toMatchObject({ ok: true });
  expect(JSON.stringify(result)).not.toContain("private-anthropic-key");
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

it("reports invalid environment configuration without exposing contents", () => {
  const result = runStartupPreflight({
    ...passingOptions(),
    loadEnvironment: () => {
      throw new Error("private-test-key");
    },
  });
  expect(result).toMatchObject({
    ok: false,
    errors: expect.arrayContaining([
      expect.objectContaining({ code: "STARTUP_ENV_INVALID" }),
    ]),
  });
  expect(JSON.stringify(result)).not.toContain("private-test-key");
});

it("reports an unwritable data directory", () => {
  const result = runStartupPreflight({
    ...passingOptions(),
    checkDataDirectory: () => {
      throw new Error("permission denied");
    },
  });
  expect(result).toMatchObject({
    ok: false,
    errors: expect.arrayContaining([
      expect.objectContaining({ code: "STARTUP_DATA_DIR_UNWRITABLE" }),
    ]),
  });
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

it("reinstalls a wrong client version", () => {
  const setupOts = vi.fn(() => 0);
  const detectOts = vi
    .fn()
    .mockReturnValueOnce("v0.7.1")
    .mockReturnValueOnce("v0.7.2");
  expect(
    runStartupPreflight({
      ...passingOptions(),
      detectOts,
      setupOts,
    }),
  ).toMatchObject({ ok: true });
  expect(setupOts).toHaveBeenCalledTimes(1);
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
  expect(output).toContain(
    "Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env.",
  );
  expect(output).not.toContain("must-not-appear");
});
