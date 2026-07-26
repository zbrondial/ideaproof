import { describe, expect, it } from "vitest";

import {
  mutualNdaSchema,
  technicalSpecificationSchema,
} from "@/server/generation/schemas";
import {
  countWords,
  toNdaMarkdown,
  toSpecificationMarkdown,
} from "@/server/generation/word-count";

const validSpecification = {
  title: "IdeaProof",
  productOverview: "A concise local proof app.",
  coreFeatures: ["Generate documents", "Timestamp approved PDFs"],
  technicalArchitecture: "A local Next.js application backed by SQLite.",
  apiDesign: "Server routes validate project and document actions.",
  securityConsiderations: [
    "Keep API keys on the server",
    "Validate uploaded proof files",
  ],
};

describe("generation schemas", () => {
  it("rejects unknown specification fields", () => {
    expect(() =>
      technicalSpecificationSchema.parse({
        ...validSpecification,
        inventedMetric: "99%",
      }),
    ).toThrow();
  });

  it("allows blank NDA facts but requires the purpose and notice", () => {
    const nda = mutualNdaSchema.parse({
        title: "Sample Non-Disclosure Agreement",
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
      });
    expect(nda.partyA).toBe("");
    expect(toNdaMarkdown(nda)).toMatch(
      /^# Sample Non-Disclosure Agreement/m,
    );
  });

  it("renders the five canonical specification sections in order", () => {
    expect(toSpecificationMarkdown(validSpecification)).toMatch(
      /## 1\. Product Overview[\s\S]*## 2\. Core Features[\s\S]*## 3\. Technical Architecture[\s\S]*## 4\. API Design[\s\S]*## 5\. Security Considerations/,
    );
  });
});

it("counts visible Markdown words", () => {
  expect(countWords("# A title\n\n- One **clear** point.")).toBe(5);
});
