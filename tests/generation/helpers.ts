import type { TechnicalSpecificationOutput } from "@/server/generation/schemas";

export const validSpecInput = {
  documentType: "specification" as const,
  idea: "A local web app that creates concise idea documents and timestamps approved PDFs.",
  technologyPreference: "Next.js and SQLite",
  ndaPurpose: "Discuss a possible product collaboration",
  ndaDetails: "",
};

export function specWithWords(count: number): TechnicalSpecificationOutput {
  const words = Array.from(
    { length: count },
    (_, index) => `word${index}`,
  ).join(" ");
  return {
    title: "IdeaProof",
    productOverview: words,
    coreFeatures: ["Generate concise documents", "Timestamp approved PDFs"],
    technicalArchitecture: "Run locally with Next.js and SQLite.",
    apiDesign: "Use validated server routes for project actions.",
    securityConsiderations: [
      "Keep provider API keys on the server",
      "Validate proof uploads",
    ],
  };
}

export function fakeResponses(outputs: TechnicalSpecificationOutput[]) {
  const calls: unknown[] = [];
  return {
    provider: "openai" as const,
    calls,
    async parse(request: unknown) {
      calls.push(request);
      const parsed = outputs.shift();
      if (!parsed) throw new Error("No fake response remaining");
      return { id: `resp_${calls.length}`, model: "gpt-5.6", parsed };
    },
  };
}
