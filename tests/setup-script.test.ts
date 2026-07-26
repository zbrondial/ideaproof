import { describe, expect, it, vi } from "vitest";

import { findPython } from "@/scripts/setup-ots.mjs";

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
