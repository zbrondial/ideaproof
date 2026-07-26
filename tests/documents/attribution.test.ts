import { expect, it } from "vitest";

import { withOwnerDeclaration } from "@/server/documents/attribution";

it("appends the exact owner declaration to a specification", () => {
  expect(
    withOwnerDeclaration("# Specification\n\nBody.\n", "Ada Lovelace"),
  ).toBe(`# Specification

Body.

---

**Prepared and claimed by:** Ada Lovelace

The named person declares that they prepared and claim ownership of this documented idea.
`);
});

it("leaves legacy specifications unchanged when no owner is stored", () => {
  expect(withOwnerDeclaration("# Legacy\n", "")).toBe("# Legacy\n");
});

it("keeps exactly one declaration when applied more than once", () => {
  const markdown = withOwnerDeclaration(
    withOwnerDeclaration("# Specification\n", "Ada Lovelace"),
    "Ada Lovelace",
  );

  expect(markdown.match(/Prepared and claimed by/g)).toHaveLength(1);
});

it("removes a provider-authored reserved marker before appending", () => {
  const markdown = withOwnerDeclaration(
    `# Specification

The provider wrote Prepared and claimed by: Someone Else in the body.
`,
    "Ada Lovelace",
  );

  expect(markdown).not.toContain("Someone Else");
  expect(markdown.match(/Prepared and claimed by/gi)).toHaveLength(1);
});

it("replaces a noncanonical attribution block with the local declaration", () => {
  const markdown = withOwnerDeclaration(
    `# Specification

**Prepared and claimed by:** Someone Else

The named person declares that they prepared and claim ownership of this documented idea.

## Remaining content

Keep this section.
`,
    "Ada Lovelace",
  );

  expect(markdown).not.toContain("Someone Else");
  expect(markdown).toContain("Keep this section.");
  expect(markdown.match(/Prepared and claimed by/gi)).toHaveLength(1);
});

it("defensively removes the reserved marker from an unvalidated owner name", () => {
  const markdown = withOwnerDeclaration(
    "# Specification\n",
    "Prepared and claimed by Ada Lovelace",
  );

  expect(markdown).toContain(
    "**Prepared and claimed by:** Ada Lovelace",
  );
  expect(markdown.match(/Prepared and claimed by/gi)).toHaveLength(1);
});

it("preserves accepted interior owner-name spacing", () => {
  const markdown = withOwnerDeclaration(
    "# Specification\n",
    "Ada  Lovelace",
  );

  expect(markdown).toContain(
    "**Prepared and claimed by:** Ada  Lovelace",
  );
});

it("does not leave punctuation from a reserved declaration owner value", () => {
  const specification = "# Specification\n";

  expect(
    withOwnerDeclaration(
      specification,
      "The named person declares that they prepared and claim ownership of this documented idea.",
    ),
  ).toBe(specification);
});

it("preserves provider Markdown spacing outside reserved lines", () => {
  const markdown = "# Specification\n\n\nBody.\n";

  expect(withOwnerDeclaration(markdown, "Ada Lovelace")).toContain(
    "# Specification\n\n\nBody.",
  );
});
