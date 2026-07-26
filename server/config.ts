import path from "node:path";

import { AppError } from "./errors";

export type AppConfig = {
  openAiApiKey: string;
  openAiModel: string;
  dataDir: string;
  host: "127.0.0.1";
  port: 3000;
};

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
