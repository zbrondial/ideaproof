import { expect, it } from "vitest";

import { toNdaMarkdown } from "@/server/generation/word-count";

it("renders NDA field labels once when a provider repeats them", () => {
  const markdown = toNdaMarkdown({
    title: "Sample Non-Disclosure Agreement",
    notice:
      "Not legal advice. Review this template with a qualified attorney before use.",
    partyA: "Party A: ______________________",
    partyB: "Party B: ______________________",
    effectiveDate: "Effective date: ______________________",
    purpose: "Discuss the idea.",
    confidentialInformation: "Non-public idea information.",
    exclusions: "Public information.",
    obligations: "Keep the information confidential.",
    confidentialityPeriod:
      "Confidentiality period: ______________________",
    returnOrDestruction: "Return or destroy it on request.",
    signatures: "Party A signature: ______\nParty B signature: ______",
  });

  expect(markdown).toContain("**Party A:** ______________________");
  expect(markdown).toContain("**Party B:** ______________________");
  expect(markdown).toContain("**Effective date:** ______________________");
  expect(markdown).toContain(
    "**Confidentiality period:** ______________________",
  );
  expect(markdown).not.toMatch(/\*\*Party A:\*\* Party A:/);
  expect(markdown).not.toMatch(/\*\*Party B:\*\* Party B:/);
  expect(markdown).not.toMatch(/\*\*Effective date:\*\* Effective date:/i);
});
