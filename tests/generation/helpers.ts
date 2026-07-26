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
    ideaSummary: words,
    problemAndUser: "Founders need concise records.",
    goals: ["Generate concise documents"],
    nonGoals: ["Prove legal ownership"],
    coreFlow: ["Describe", "Review", "Approve"],
    technicalApproach: "Run locally.",
    boundaries: ["OpenAI receives generation input"],
    risksAndDecisions: ["Generated content needs review"],
    nextSteps: ["Validate the idea"],
  };
}

export function fakeResponses(outputs: TechnicalSpecificationOutput[]) {
  const calls: unknown[] = [];
  return {
    calls,
    async parse(request: unknown) {
      calls.push(request);
      const parsed = outputs.shift();
      if (!parsed) throw new Error("No fake response remaining");
      return { id: `resp_${calls.length}`, model: "gpt-5.6", parsed };
    },
  };
}
