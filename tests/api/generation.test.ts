import { expect, it } from "vitest";

import { AppError } from "@/server/errors";
import { handleGenerate } from "@/app/api/projects/[id]/generate/[documentType]/route";

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

it("returns a safe 404 when the project does not exist", async () => {
  const harness = createGenerationHarness();
  try {
    const response = await handleGenerate({
      projectId: "00000000-0000-4000-8000-000000000099",
      documentType: "specification",
      store: harness.store,
      generation: harness.mockGeneration,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "PROJECT_NOT_FOUND" });
  } finally {
    harness.close();
  }
});

it("rejects generation before calling OpenAI after approval", async () => {
  const harness = createGenerationHarness({ withExistingDocuments: true });
  try {
    harness.store.transitionProject(harness.project.id, "draft", "generating");
    harness.store.transitionProject(harness.project.id, "generating", "review");
    harness.store.createApproval({
      projectId: harness.project.id,
      specificationRevisionId: harness.spec!.id,
      ndaRevisionId: harness.nda!.id,
      packagePath: "artifacts/package.zip",
      artifacts: [
        {
          documentType: "specification",
          pdfPath: "artifacts/specification.pdf",
          markdownPath: "artifacts/specification.md",
          otsPath: "artifacts/specification.pdf.ots",
          sha256: "a".repeat(64),
        },
        {
          documentType: "nda",
          pdfPath: "artifacts/nda.pdf",
          markdownPath: "artifacts/nda.md",
          otsPath: "artifacts/nda.pdf.ots",
          sha256: "b".repeat(64),
        },
      ],
    });

    const response = await harness.generate("specification");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "PROJECT_IMMUTABLE" });
    expect(harness.mockGeneration.specification).not.toHaveBeenCalled();
  } finally {
    harness.close();
  }
});
