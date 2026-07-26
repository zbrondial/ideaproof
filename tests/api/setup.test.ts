import { expect, it, vi } from "vitest";

import { handleSetup } from "@/app/api/setup/route";

it("reports missing setup without exposing environment values", async () => {
  const response = await handleSetup({
    openAiApiKey: "",
    checkDataDirectory: async () => true,
    detectPython: () => null,
    detectOts: () => null,
  });
  const body = await response.json();

  expect(body).toEqual({
    ready: false,
    checks: expect.arrayContaining([
      expect.objectContaining({ code: "SETUP_OPENAI_KEY_MISSING" }),
      expect.objectContaining({ code: "SETUP_PYTHON_MISSING" }),
      expect.objectContaining({ code: "SETUP_OTS_MISSING" }),
    ]),
  });
  expect(JSON.stringify(body)).not.toContain("sk-private-value");
});

it("reports ready when all local prerequisites pass", async () => {
  const response = await handleSetup({
    openAiApiKey: "sk-private-value",
    checkDataDirectory: async () => true,
    detectPython: vi.fn(() => "Python 3.12.4"),
    detectOts: vi.fn(() => "v0.7.2"),
  });

  expect(await response.json()).toMatchObject({ ready: true });
});
