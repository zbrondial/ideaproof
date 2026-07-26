import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "@/server/config";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("loadConfig", () => {
  it("applies local-safe defaults when an API key is configured", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.OPENAI_MODEL;
    delete process.env.IDEAPROOF_DATA_DIR;

    expect(loadConfig()).toMatchObject({
      openAiApiKey: "sk-test",
      openAiModel: "gpt-5.6",
      host: "127.0.0.1",
      port: 3000,
    });
  });

  it("rejects a missing API key with a stable setup error", () => {
    delete process.env.OPENAI_API_KEY;

    expect(() => loadConfig()).toThrowError(
      expect.objectContaining({ code: "SETUP_OPENAI_KEY_MISSING" }),
    );
  });
});
