import { expect, it, vi } from "vitest";

import { handleSetup } from "@/app/api/setup/route";

it("reports missing setup without exposing environment values", async () => {
  const response = await handleSetup({
    openAiApiKey: "",
    anthropicApiKey: "",
    checkDataDirectory: async () => true,
    detectPython: () => null,
    detectOts: () => null,
  });
  const body = await response.json();

  expect(body).toEqual({
    ready: false,
    checks: expect.arrayContaining([
      expect.objectContaining({ code: "SETUP_OPENAI_KEY_MISSING" }),
      expect.objectContaining({ code: "SETUP_ANTHROPIC_KEY_MISSING" }),
      expect.objectContaining({ code: "SETUP_PROVIDER_MISSING" }),
      expect.objectContaining({ code: "SETUP_PYTHON_MISSING" }),
      expect.objectContaining({ code: "SETUP_OTS_MISSING" }),
    ]),
  });
  expect(JSON.stringify(body)).not.toContain("private-test-key");
});

it("reports ready when all local prerequisites pass", async () => {
  const response = await handleSetup({
    openAiApiKey: "private-test-key",
    anthropicApiKey: "",
    checkDataDirectory: async () => true,
    detectPython: vi.fn(() => "Python 3.12.4"),
    detectOts: vi.fn(() => "v0.7.2"),
  });

  const body = await response.json();
  expect(body).toMatchObject({
    ready: true,
    checks: expect.arrayContaining([
      expect.objectContaining({ code: "SETUP_OPENAI_KEY_READY" }),
      expect.objectContaining({ code: "SETUP_ANTHROPIC_KEY_MISSING" }),
      expect.objectContaining({ code: "SETUP_PROVIDER_READY" }),
    ]),
  });
  expect(JSON.stringify(body)).not.toContain("private-test-key");
});

it("accepts Anthropic as the only configured provider", async () => {
  const response = await handleSetup({
    openAiApiKey: "",
    anthropicApiKey: "anthropic-private-test-key",
    checkDataDirectory: async () => true,
    detectPython: vi.fn(() => "Python 3.12.4"),
    detectOts: vi.fn(() => "v0.7.2"),
  });

  const body = await response.json();
  expect(body).toMatchObject({
    ready: true,
    checks: expect.arrayContaining([
      expect.objectContaining({ code: "SETUP_OPENAI_KEY_MISSING" }),
      expect.objectContaining({ code: "SETUP_ANTHROPIC_KEY_READY" }),
      expect.objectContaining({ code: "SETUP_PROVIDER_READY" }),
    ]),
  });
  expect(JSON.stringify(body)).not.toContain("anthropic-private-test-key");
});
