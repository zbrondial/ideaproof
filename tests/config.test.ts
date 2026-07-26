import { afterEach, describe, expect, it } from "vitest";

import {
  listConfiguredProviders,
  loadConfig,
  loadStorageConfig,
  requireProviderConfig,
} from "@/server/config";

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

  it("loads local storage without requiring an OpenAI key", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.IDEAPROOF_DATA_DIR;

    expect(loadStorageConfig().dataDir).toMatch(/data$/);
  });
});

describe("provider configuration", () => {
  it("lists only configured providers without returning keys", () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.OPENAI_MODEL = "gpt-5.6";
    delete process.env.ANTHROPIC_API_KEY;

    expect(listConfiguredProviders()).toEqual([
      { provider: "openai", model: "gpt-5.6", label: "OpenAI — gpt-5.6" },
    ]);
    expect(JSON.stringify(listConfiguredProviders())).not.toContain(
      "openai-test-key",
    );
  });

  it("orders OpenAI before Claude when both are configured", () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.ANTHROPIC_API_KEY = "anthropic-test-key";
    delete process.env.ANTHROPIC_MODEL;

    expect(listConfiguredProviders()).toEqual([
      { provider: "openai", model: "gpt-5.6", label: "OpenAI — gpt-5.6" },
      {
        provider: "anthropic",
        model: "claude-opus-4-8",
        label: "Claude — claude-opus-4-8",
      },
    ]);
  });

  it("uses a stored project model when the provider key remains configured", () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-test-key";
    process.env.ANTHROPIC_MODEL = "claude-new-default";

    expect(
      requireProviderConfig("anthropic", "claude-opus-4-8"),
    ).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-4-8",
      apiKey: "anthropic-test-key",
    });
  });

  it("rejects a project provider whose key is no longer configured", () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(() =>
      requireProviderConfig("anthropic", "claude-opus-4-8"),
    ).toThrowError(expect.objectContaining({ code: "SETUP_MODEL_UNAVAILABLE" }));
  });
});
