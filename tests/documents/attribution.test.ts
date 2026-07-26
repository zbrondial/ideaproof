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
