import path from "node:path";

import { AppError } from "./errors";

export type AppConfig = {
  openAiApiKey: string;
  openAiModel: string;
  dataDir: string;
  host: "127.0.0.1";
  port: 3000;
};

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
    openAiApiKey,
    openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.6",
    dataDir: path.resolve(process.env.IDEAPROOF_DATA_DIR || "./data"),
    host: "127.0.0.1",
    port: 3000,
  };
}
