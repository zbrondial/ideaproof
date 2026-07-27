import { expect, it } from "vitest";

import { AppError } from "@/server/errors";

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
    expect(harness.store.getRevisions(harness.project.id, "nda")).toEqual([
      expect.objectContaining({ version: 1, provider: "openai" }),
      expect.objectContaining({
        version: 2,
        ideaVersionId: harness.project.currentIdeaVersionId,
        provider: "openai",
        providerResponseId: "resp_nda",
      }),
    ]);
  } finally {
    harness.close();
  }
});

it("keeps the locally stored owner name out of revision provider input", async () => {
  const harness = createGenerationHarness({
    withExistingDocuments: true,
    ownerName: "Private Owner Sentinel",
  });
  try {
    harness.mockGeneration.revise.mockResolvedValue(validGeneratedNda);

    expect(
      (
        await harness.revise({
          documentType: "nda",
          revisionId: harness.nda!.id,
          feedback: "Use shorter sentences.",
        })
      ).status,
    ).toBe(201);
    expect(
      JSON.stringify(harness.mockGeneration.revise.mock.calls),
    ).not.toContain("Private Owner Sentinel");
  } finally {
    harness.close();
  }
});

it.each([
  ["OPENAI_RATE_LIMITED", 429],
  ["OPENAI_REFUSED", 422],
  ["OPENAI_OUTPUT_INVALID", 422],
])(
  "moves a project to failed after %s revision errors",
  async (code, status) => {
    const harness = createGenerationHarness({ withExistingDocuments: true });
    try {
      harness.mockGeneration.revise.mockRejectedValue(
        new AppError(code, "Safe revision error.", status, status === 429),
      );

      const response = await harness.revise({
        documentType: "nda",
        revisionId: harness.nda!.id,
        feedback: "Use shorter sentences.",
      });

      expect(response.status).toBe(status);
      expect(harness.store.getProject(harness.project.id).status).toBe(
        "failed",
      );
    } finally {
      harness.close();
    }
  },
);
