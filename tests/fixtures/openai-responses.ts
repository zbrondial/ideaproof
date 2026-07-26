import { writeFile } from "node:fs/promises";

import type { AiProvider } from "@/server/config";
import type { ResponsesPort } from "@/server/generation/service";
import type {
  MutualNdaOutput,
  TechnicalSpecificationOutput,
} from "@/server/generation/schemas";

const specification: TechnicalSpecificationOutput = {
  title: "IdeaProof local proof application",
  productOverview:
    "A local web application that turns an early product idea into a concise technical specification and a simple mutual NDA, then timestamps the approved PDFs.",
  coreFeatures: [
    "Generate two concise documents from supplied facts",
    "Keep project records on the user's machine",
    "Timestamp the exact approved PDF bytes",
    "Review and revise either document before approval",
    "Download and verify the timestamp proof package",
  ],
  technicalArchitecture:
    "Run a Next.js application on localhost with SQLite storage, server-only AI provider calls, deterministic PDF rendering, and a project-local OpenTimestamps client.",
  apiDesign:
    "Validated server routes create projects, generate and revise documents, approve exact revisions, check proof status, and verify uploaded PDF proof pairs.",
  securityConsiderations: [
    "Provider API keys remain on the server",
    "Project records and artifacts remain in the configured local data directory",
    "Generated content can contain errors and requires review",
    "Timestamps verify exact PDF bytes but do not prove ownership",
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

const responseNumbers: Record<AiProvider, number> = {
  openai: 0,
  anthropic: 0,
};

export function createFixtureResponsesPort(
  provider: AiProvider,
  model: string,
): ResponsesPort {
  return {
    provider,
    model,
    async parse(request) {
      responseNumbers[provider] += 1;
      const isNdaRevision =
        request.documentType === "nda" &&
        request.prompt.includes('"revisionFeedback"');
      const prefix = provider === "openai" ? "resp" : "msg";
      return {
        id: `${prefix}_fixture_${responseNumbers[provider]}`,
        model,
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
}

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
