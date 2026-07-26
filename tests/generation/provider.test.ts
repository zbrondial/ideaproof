import { expect, it } from "vitest";

import { selectProviderFactory } from "@/server/generation/provider";

it("routes a fixed project model to Anthropic", () => {
  expect(
    selectProviderFactory("anthropic", {
      openai: "openai-factory",
      anthropic: "anthropic-factory",
    }),
  ).toBe("anthropic-factory");
});
