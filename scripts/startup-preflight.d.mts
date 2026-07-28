import type {
  PythonCandidate,
  PythonVersionRunner,
} from "./setup-ots.mjs";

export type PreflightError = {
  code: string;
  message: string;
  remediation: string;
};

export type PreflightResult =
  | { ok: true; messages: string[] }
  | { ok: false; errors: PreflightError[] };

export type PreflightEnvironment = Record<string, string | undefined>;

export type EnvironmentDependencies = {
  exists?: (path: string) => boolean;
  read?: (path: string, encoding: "utf8") => string;
};

export type DataDirectoryDependencies = {
  mkdir?: (
    path: string,
    options: { recursive: true },
  ) => unknown;
  write?: (path: string, contents: string) => unknown;
  unlink?: (path: string) => unknown;
};

export type StartupPreflightOptions = {
  root?: string;
  platform?: NodeJS.Platform;
  nodeVersion?: string;
  inheritedEnv?: PreflightEnvironment;
  run?: PythonVersionRunner;
  loadEnvironment?: (
    root: string,
    inheritedEnv: PreflightEnvironment,
  ) => PreflightEnvironment;
  detectNpm?: () => string | null;
  detectPython?: () => PythonCandidate | null;
  checkDataDirectory?: (
    root: string,
    env: PreflightEnvironment,
  ) => string;
  detectOts?: () => string | null;
  setupOts?: () => number;
};

export function meetsMinimumVersion(
  output: string | null | undefined,
  minimumMajor: number,
  minimumMinor: number,
): boolean;

export function loadPreflightEnvironment(
  root: string,
  inheritedEnv?: PreflightEnvironment,
  dependencies?: EnvironmentDependencies,
): PreflightEnvironment;

export function checkWritableDataDirectory(
  root: string,
  env: PreflightEnvironment,
  dependencies?: DataDirectoryDependencies,
): string;

export function runStartupPreflight(
  options?: StartupPreflightOptions,
): PreflightResult;

export function formatPreflightResult(
  result: PreflightResult,
): string;
