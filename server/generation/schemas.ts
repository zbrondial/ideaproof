import { z } from "zod";

export const technicalSpecificationSchema = z
  .object({
    title: z.string().min(1).max(120),
    ideaSummary: z.string().min(1),
    problemAndUser: z.string().min(1),
    goals: z.array(z.string().min(1)).min(1).max(6),
    nonGoals: z.array(z.string().min(1)).max(6),
    coreFlow: z.array(z.string().min(1)).min(1).max(8),
    technicalApproach: z.string().min(1),
    boundaries: z.array(z.string().min(1)).max(8),
    risksAndDecisions: z.array(z.string().min(1)).max(8),
    nextSteps: z.array(z.string().min(1)).max(8),
  })
  .strict();

export const mutualNdaSchema = z
  .object({
    title: z.literal("Mutual Non-Disclosure Agreement"),
    notice: z.literal(
      "Not legal advice. Review this template with a qualified attorney before use.",
    ),
    partyA: z.string(),
    partyB: z.string(),
    effectiveDate: z.string(),
    purpose: z.string().min(1),
    confidentialInformation: z.string().min(1),
    exclusions: z.string().min(1),
    obligations: z.string().min(1),
    confidentialityPeriod: z.string(),
    returnOrDestruction: z.string().min(1),
    signatures: z.string().min(1),
  })
  .strict();

export type TechnicalSpecificationOutput = z.infer<
  typeof technicalSpecificationSchema
>;
export type MutualNdaOutput = z.infer<typeof mutualNdaSchema>;
