import { expect, it } from "vitest";

import { AppError } from "@/server/errors";

import {
  createGenerationHarness,
  validGeneratedSpec,
} from "./generation-harness";

it("generates documents independently and retains a successful sibling", async () => {
  const harness = createGenerationHarness();
  try {
    harness.mockGeneration.specification.mockResolvedValue(validGeneratedSpec);
    harness.mockGeneration.nda.mockRejectedValue(
      new AppError("OPENAI_RATE_LIMITED", "Try again.", 429, true),
    );

    expect((await harness.generate("specification")).status).toBe(201);
    expect((await harness.generate("nda")).status).toBe(429);
    expect(
      harness.store.getRevisions(harness.project.id, "specification"),
    ).toHaveLength(1);
    expect(
      harness.store.getRevisions(harness.project.id, "nda"),
    ).toHaveLength(0);
  } finally {
    harness.close();
  }
});
