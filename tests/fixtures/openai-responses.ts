import { writeFile } from "node:fs/promises";

import type { ResponsesPort } from "@/server/generation/service";
import type {
  MutualNdaOutput,
  TechnicalSpecificationOutput,
} from "@/server/generation/schemas";

const specification: TechnicalSpecificationOutput = {
  title: "IdeaProof local proof application",
  ideaSummary:
    "A local web application that turns an early product idea into a concise technical specification and a simple mutual NDA, then timestamps the approved PDFs.",
  problemAndUser:
    "Founders and independent builders need a reviewable record of an early idea without adopting a hosted project system.",
  goals: [
    "Generate two concise documents from supplied facts",
    "Keep project records on the user's machine",
    "Timestamp the exact approved PDF bytes",
  ],
  nonGoals: [
    "Prove ownership or authorship",
    "Replace legal review",
    "Operate as a hosted collaboration service",
  ],
  coreFlow: [
    "Describe the idea and NDA purpose",
    "Generate and review both documents",
    "Revise either document",
    "Approve exact revisions",
    "Download and verify the timestamp proof package",
  ],
  technicalApproach:
    "Run a Next.js application on localhost with SQLite storage, server-only OpenAI calls, deterministic PDF rendering, and a project-local OpenTimestamps client.",
  boundaries: [
    "Generation sends required content to OpenAI",
    "Project records and artifacts remain in the configured local data directory",
  ],
  risksAndDecisions: [
    "Generated content can contain errors and requires review",
    "Bitcoin confirmation can take hours",
  ],
  nextSteps: [
    "Test the workflow with representative early-stage ideas",
    "Review the NDA template with qualified counsel before relying on it",
  ],
};

const nda: MutualNdaOutput = {
  title: "Mutual Non-Disclosure Agreement",
  notice:
    "Not legal advice. Review this template with a qualified attorney before use.",
  partyA: "",
  partyB: "",
  effectiveDate: "",
  purpose: "Discuss a possible product collaboration.",
  confidentialInformation:
    "Non-public product ideas, designs, plans, technical details, and business information shared for the stated purpose.",
  exclusions:
    "Information is not confidential if it was already lawfully known, becomes public without breach, is received lawfully from another source, or is developed independently.",
  obligations:
    "Each party will use confidential information only for the stated purpose, protect it with reasonable care, and share it only with people who need it and have similar duties.",
  confidentialityPeriod: "",
  returnOrDestruction:
    "On request, each party will return or destroy confidential materials, except copies retained only when required by law or routine backup systems.",
  signatures:
    "Party A signature: ______________________\n\nParty B signature: ______________________",
};

let responseNumber = 0;

export const fixtureResponsesPort: ResponsesPort = {
  provider: "openai",
  async parse(request) {
    responseNumber += 1;
    const isNdaRevision =
      request.documentType === "nda" &&
      request.prompt.includes('"revisionFeedback"');
    return {
      id: `resp_fixture_${responseNumber}`,
      model: "gpt-5.6",
      parsed:
        request.documentType === "specification"
          ? specification
          : isNdaRevision
            ? {
                ...nda,
                obligations: `${nda.obligations} Revision two uses shorter sentences.`,
              }
            : nda,
    };
  },
};

export async function fixtureStampPdf(pdfPath: string) {
  const otsPath = `${pdfPath}.ots`;
  await writeFile(otsPath, "deterministic OpenTimestamps fixture\n");
  return { status: "pending" as const, otsPath };
}

export async function fixtureCheckProof() {
  return {
    status: "confirmed" as const,
    bitcoinBlockHeight: 900000,
    confirmedAt: "2026-07-25",
  };
}
