const declaration =
  "The named person declares that they prepared and claim ownership of this documented idea.";

export function withOwnerDeclaration(
  markdown: string,
  ownerName: string,
): string {
  const name = ownerName.trim();
  if (!name) return markdown;
  const withoutExisting = markdown.replace(
    /\n+---\n+\*\*Prepared and claimed by:\*\*[\s\S]*$/u,
    "",
  );
  return `${withoutExisting.trimEnd()}

---

**Prepared and claimed by:** ${name}

${declaration}
`;
}
