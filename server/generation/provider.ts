import type { AiProvider } from "@/server/config";
import { requireProviderConfig } from "@/server/config";

import { createAnthropicResponsesPort } from "./anthropic-client";
import { createOpenAiResponsesPort } from "./client";

export function selectProviderFactory<T>(
  provider: AiProvider,
  factories: Record<AiProvider, T>,
) {
  return factories[provider];
}

export function createGenerationPort(provider: AiProvider, model: string) {
  const config = requireProviderConfig(provider, model);
  return selectProviderFactory(provider, {
    openai: () => createOpenAiResponsesPort(config),
    anthropic: () => createAnthropicResponsesPort(config),
  })();
}
