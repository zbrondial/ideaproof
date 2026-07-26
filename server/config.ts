import path from "node:path";

import { AppError } from "./errors";

export type AppConfig = {
  openAiApiKey: string;
  openAiModel: string;
  dataDir: string;
  host: "127.0.0.1";
  port: 3000;
};

export type AiProvider = "openai" | "anthropic";

export type ProviderSummary = {
  provider: AiProvider;
  model: string;
  label: string;
};

export type ProviderConfig = ProviderSummary & { apiKey: string };

export function listConfiguredProviders(): ProviderSummary[] {
  const providers: ProviderSummary[] = [];
  if (process.env.OPENAI_API_KEY?.trim()) {
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
    providers.push({ provider: "openai", model, label: `OpenAI — ${model}` });
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    const model =
      process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-8";
    providers.push({
      provider: "anthropic",
      model,
      label: `Claude — ${model}`,
    });
  }
  return providers;
}

export function requireProviderConfig(
  provider: AiProvider,
  model: string,
): ProviderConfig {
  const available = listConfiguredProviders().find(
    (item) => item.provider === provider && item.model === model,
  );
  if (!available) {
    throw new AppError(
      "SETUP_MODEL_UNAVAILABLE",
      "Restore the API key and model configured for this project.",
      503,
    );
  }
  return {
    ...available,
    apiKey:
      provider === "openai"
        ? process.env.OPENAI_API_KEY!.trim()
        : process.env.ANTHROPIC_API_KEY!.trim(),
  };
}

export function loadStorageConfig(): Pick<AppConfig, "dataDir" | "host" | "port"> {
  const configuredDataDir = process.env.IDEAPROOF_DATA_DIR?.trim();
  return {
    dataDir: configuredDataDir
      ? path.resolve(/* turbopackIgnore: true */ configuredDataDir)
      : path.join(/* turbopackIgnore: true */ process.cwd(), "data"),
    host: "127.0.0.1",
    port: 3000,
  };
}

export function loadConfig(): AppConfig {
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiApiKey) {
    throw new AppError(
      "SETUP_OPENAI_KEY_MISSING",
      "Add OPENAI_API_KEY to your local .env file.",
      503,
    );
  }

  return {
    ...loadStorageConfig(),
    openAiApiKey,
    openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.6",
  };
}
