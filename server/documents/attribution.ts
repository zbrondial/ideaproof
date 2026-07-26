const declaration =
  "The named person declares that they prepared and claim ownership of this documented idea.";

export function withOwnerDeclaration(
  markdown: string,
  ownerName: string,
): string {
  const name = ownerName
    .replace(
      /the named person declares that they prepared and claim ownership of this documented idea\.?|prepared and claimed by/giu,
      "",
    )
    .trim();
  if (!name) return markdown;
  const withoutExisting = markdown.replace(
    /\n+---\n+\*\*Prepared and claimed by:\*\*[\s\S]*$/u,
    "",
  );
  const withoutReservedMarkers = withoutExisting
    .split("\n")
    .filter(
      (line) =>
        !/prepared and claimed by/iu.test(line) &&
        !/the named person declares that they prepared and claim ownership of this documented idea\./iu.test(
          line,
        ),
    )
    .join("\n");
  return `${withoutReservedMarkers.trimEnd()}

---

**Prepared and claimed by:** ${name}

${declaration}
`;
}
