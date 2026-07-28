import { describe, expect, it, vi } from "vitest";

import {
  findPython,
  resolveOtsExecutable,
  resolveVenvPython,
  setupOpenTimestamps,
} from "@/scripts/setup-ots.mjs";

describe("findPython", () => {
  it("selects the first available Python 3.9 or newer interpreter", () => {
    const run = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: "Python 3.8.18" })
      .mockReturnValueOnce({ status: 0, stdout: "Python 3.9.6" });

    expect(
      findPython(
        [
          ["python3.8", []],
          ["python3", []],
        ],
        run,
      ),
    ).toEqual(["python3", []]);
  });

  it("returns null when no supported interpreter exists", () => {
    const run = vi.fn().mockReturnValue({ status: 0, stdout: "Python 3.8.18" });

    expect(findPython([["python3", []]], run)).toBeNull();
  });
});

describe("project-local OpenTimestamps paths", () => {
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
});

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
