import { expect, it } from "vitest";

import { parseMarkdown } from "@/server/documents/markdown";

it("parses only the canonical heading, paragraph, and list blocks", () => {
  expect(parseMarkdown("# Title\n\nA paragraph.\n\n- First\n- Second")).toEqual([
    { type: "heading", level: 1, text: "Title" },
    { type: "paragraph", text: "A paragraph." },
    { type: "listItem", text: "First" },
    { type: "listItem", text: "Second" },
  ]);
});

it.each(["<script>alert(1)</script>", "![secret](file.png)", "### Hidden"])(
  "rejects unsupported Markdown: %s",
  (markdown) => {
    expect(() => parseMarkdown(markdown)).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_MARKDOWN_INVALID" }),
    );
  },
);
