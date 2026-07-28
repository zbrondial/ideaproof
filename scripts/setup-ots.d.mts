export type PythonCandidate = [command: string, prefix: string[]];

export type PythonVersionResult = {
  status: number | null;
  stdout?: string;
  stderr?: string;
};

export type SetupProcessOptions =
  | { encoding: "utf8" }
  | { stdio: "inherit" };

export type PythonVersionRunner = (
  command: string,
  args: string[],
  options: SetupProcessOptions,
) => PythonVersionResult;

export const OTS_CLIENT_VERSION: "0.7.2";

export function findPython(
  candidates: PythonCandidate[],
  run?: PythonVersionRunner,
): PythonCandidate | null;

export type SetupOpenTimestampsOptions = {
  root?: string;
  platform?: NodeJS.Platform;
  exists?: (path: string) => boolean;
  run?: PythonVersionRunner;
};

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
