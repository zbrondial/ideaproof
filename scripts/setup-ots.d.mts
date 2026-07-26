export type PythonCandidate = [command: string, prefix: string[]];

export type PythonVersionResult = {
  status: number | null;
  stdout?: string;
  stderr?: string;
};

export type PythonVersionRunner = (
  command: string,
  args: string[],
  options: { encoding: "utf8" },
) => PythonVersionResult;

export function findPython(
  candidates: PythonCandidate[],
  run?: PythonVersionRunner,
): PythonCandidate | null;

export function setupOpenTimestamps(): number;
