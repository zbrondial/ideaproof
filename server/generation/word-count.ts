import type {
  MutualNdaOutput,
  TechnicalSpecificationOutput,
} from "./schemas";

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function toSpecificationMarkdown(
  output: TechnicalSpecificationOutput,
): string {
  return `# ${output.title}

## Idea summary

${output.ideaSummary}

## Problem and user

${output.problemAndUser}

## Goals

${list(output.goals)}

## Non-goals

${list(output.nonGoals)}

## Core flow

${list(output.coreFlow)}

## Technical approach

${output.technicalApproach}

## Boundaries

${list(output.boundaries)}

## Risks and decisions

${list(output.risksAndDecisions)}

## Next steps

${list(output.nextSteps)}
`;
}

function blank(value: string) {
  return value.trim() || "______________________";
}

export function toNdaMarkdown(output: MutualNdaOutput): string {
  return `# ${output.title}

> ${output.notice}

**Party A:** ${blank(output.partyA)}

**Party B:** ${blank(output.partyB)}

**Effective date:** ${blank(output.effectiveDate)}

## Purpose

${output.purpose}

## Confidential information

${output.confidentialInformation}

## Exclusions

${output.exclusions}

## Obligations

${output.obligations}

**Confidentiality period:** ${blank(output.confidentialityPeriod)}

## Return or destruction

${output.returnOrDestruction}

## Signatures

${output.signatures}
`;
}

export function countWords(markdown: string): number {
  const visible = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/[*_`[\]()]/g, " ")
    .trim();
  return visible ? visible.split(/\s+/u).length : 0;
}
