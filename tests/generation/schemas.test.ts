import { describe, expect, it } from "vitest";

import {
  mutualNdaSchema,
  technicalSpecificationSchema,
} from "@/server/generation/schemas";
import { countWords } from "@/server/generation/word-count";

describe("generation schemas", () => {
  it("rejects unknown specification fields", () => {
    expect(() =>
      technicalSpecificationSchema.parse({
        title: "IdeaProof",
        ideaSummary: "A concise proof app.",
        problemAndUser: "Ideas are hard to record.",
        goals: ["Create a record"],
        nonGoals: [],
        coreFlow: ["Describe", "Approve"],
        technicalApproach: "A local web app.",
        boundaries: [],
        risksAndDecisions: [],
        nextSteps: [],
        inventedMetric: "99%",
      }),
    ).toThrow();
  });

  it("allows blank NDA facts but requires the purpose and notice", () => {
    expect(
      mutualNdaSchema.parse({
        title: "Mutual Non-Disclosure Agreement",
        notice:
          "Not legal advice. Review this template with a qualified attorney before use.",
        partyA: "",
        partyB: "",
        effectiveDate: "",
        purpose: "Discuss a possible product collaboration",
        confidentialInformation: "Non-public information shared for the purpose.",
        exclusions: "Public or independently developed information.",
        obligations: "Protect and limit use of confidential information.",
        confidentialityPeriod: "",
        returnOrDestruction: "Return or destroy it on request.",
        signatures: "Party A: ______\nParty B: ______",
      }).partyA,
    ).toBe("");
  });
});

it("counts visible Markdown words", () => {
  expect(countWords("# A title\n\n- One **clear** point.")).toBe(5);
});
