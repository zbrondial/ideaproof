import { expect, it } from "vitest";

import {
  createGenerationHarness,
  validGeneratedNda,
} from "./generation-harness";

it("revises only the selected document and preserves history", async () => {
  const harness = createGenerationHarness({ withExistingDocuments: true });
  try {
    harness.mockGeneration.revise.mockResolvedValue(validGeneratedNda);

    const response = await harness.revise({
      documentType: "nda",
      revisionId: harness.nda!.id,
      feedback: "Use shorter sentences.",
    });

    expect(response.status).toBe(201);
    expect(harness.mockGeneration.revise).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: "nda",
        currentMarkdown: harness.nda!.content,
      }),
    );
    expect(harness.mockGeneration.revise).not.toHaveBeenCalledWith(
      expect.objectContaining({ currentMarkdown: harness.spec!.content }),
    );
    expect(
      harness.store.getRevisions(harness.project.id, "nda"),
    ).toHaveLength(2);
  } finally {
    harness.close();
  }
});
