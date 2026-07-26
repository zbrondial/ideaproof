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

## 1. Product Overview

${output.productOverview}

## 2. Core Features

${list(output.coreFeatures)}

## 3. Technical Architecture

${output.technicalArchitecture}

## 4. API Design

${output.apiDesign}

## 5. Security Considerations

${list(output.securityConsiderations)}
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
