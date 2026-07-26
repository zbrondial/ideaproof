import { expect, it } from "vitest";

import {
  generateDocument,
  reviseDocument,
} from "@/server/generation/service";
import type { MutualNdaOutput } from "@/server/generation/schemas";

import { fakeResponses, specWithWords, validSpecInput } from "./helpers";

function validNda(
  obligations = "Each party must protect the information.",
  confidentialInformation = "Non-public product information.",
): MutualNdaOutput {
  return {
    title: "Mutual Non-Disclosure Agreement",
    notice:
      "Not legal advice. Review this template with a qualified attorney before use.",
    partyA: "",
    partyB: "",
    effectiveDate: "",
    purpose: "Evaluate a product collaboration.",
    confidentialInformation,
    exclusions: "Information already public or independently developed.",
    obligations,
    confidentialityPeriod: "",
    returnOrDestruction:
      "Return or destroy confidential information on request.",
    signatures: "Party A: __________\nParty B: __________",
  };
}

function ndaResponses(outputs: MutualNdaOutput[]) {
  return {
    provider: "openai" as const,
    async parse() {
      const parsed = outputs.shift();
      if (!parsed) throw new Error("No fake response remaining");
      return { id: "resp_nda", model: "gpt-5.6", parsed };
    },
  };
}

it("retries an over-limit document once", async () => {
  const api = fakeResponses([specWithWords(1_201), specWithWords(900)]);
  const result = await generateDocument(validSpecInput, api);

  expect(result.wordCount).toBeLessThanOrEqual(1_200);
  expect(api.calls).toHaveLength(2);
  expect(JSON.stringify(api.calls[1])).toContain("Shorten this document");
  expect(result).toMatchObject({
    provider: "openai",
    providerResponseId: "resp_2",
  });
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

it.each([
  "This agreement is governed by the laws selected by Party A.",
  "This agreement shall be construed under the laws of California.",
  "The laws of California apply to this agreement.",
  "The choice of law is California.",
  "The parties submit to the courts of California.",
  "Exclusive venue will be in Manila.",
  "Disputes belong in the selected forum.",
  "The parties accept the jurisdiction of local courts.",
])("rejects prohibited NDA language: %s", async (clause) => {
  await expect(
    generateDocument(
      {
        documentType: "nda",
        idea: "A private collaboration tool.",
        ndaPurpose: "Evaluate a product collaboration.",
      },
      ndaResponses([validNda(clause)]),
    ),
  ).rejects.toMatchObject({ code: "OPENAI_OUTPUT_INVALID" });
});

it("validates the shortened NDA response", async () => {
  const longText = Array.from(
    { length: 750 },
    (_, index) => `detail${index}`,
  ).join(" ");

  await expect(
    generateDocument(
      {
        documentType: "nda",
        idea: "A private collaboration tool.",
        ndaPurpose: "Evaluate a product collaboration.",
      },
      ndaResponses([
        validNda("Each party must protect the information.", longText),
        validNda("The laws of California apply to this agreement."),
      ]),
    ),
  ).rejects.toMatchObject({ code: "OPENAI_OUTPUT_INVALID" });
});

it("validates revised NDA responses", async () => {
  await expect(
    reviseDocument(
      {
        documentType: "nda",
        idea: "A private collaboration tool.",
        ndaPurpose: "Evaluate a product collaboration.",
        currentRevision: "# Existing NDA",
        feedback: "Make it clearer.",
      },
      ndaResponses([
        validNda("This agreement has exclusive venue in California."),
      ]),
    ),
  ).rejects.toMatchObject({ code: "OPENAI_OUTPUT_INVALID" });
});
