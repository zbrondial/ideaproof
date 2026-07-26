import { expect, it } from "vitest";

import {
  generateDocument,
  reviseDocument,
} from "@/server/generation/service";

import { fakeResponses, specWithWords, validSpecInput } from "./helpers";

it("retries an over-limit document once", async () => {
  const api = fakeResponses([specWithWords(1_201), specWithWords(900)]);
  const result = await generateDocument(validSpecInput, api);

  expect(result.wordCount).toBeLessThanOrEqual(1_200);
  expect(api.calls).toHaveLength(2);
  expect(JSON.stringify(api.calls[1])).toContain("Shorten this document");
});

it("fails after the single shortening retry", async () => {
  const api = fakeResponses([specWithWords(1_201), specWithWords(1_201)]);

  await expect(generateDocument(validSpecInput, api)).rejects.toMatchObject({
    code: "OPENAI_OUTPUT_TOO_LONG",
  });
  expect(api.calls).toHaveLength(2);
});

it("revises only the selected document and shortens it once when needed", async () => {
  const api = fakeResponses([specWithWords(1_201), specWithWords(800)]);
  const result = await reviseDocument(
    {
      ...validSpecInput,
      currentRevision: "# Current selected specification",
      feedback: "Make the implementation steps clearer",
    },
    api,
  );

  expect(result.wordCount).toBeLessThanOrEqual(1_200);
  expect(api.calls).toHaveLength(2);
  expect(JSON.stringify(api.calls[0])).toContain(
    "# Current selected specification",
  );
  expect(JSON.stringify(api.calls[1])).toContain("Shorten this document");
});
