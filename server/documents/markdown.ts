import { AppError } from "@/server/errors";

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "paragraph"; text: string }
  | { type: "listItem"; text: string };

function invalid(): never {
  throw new AppError(
    "DOCUMENT_MARKDOWN_INVALID",
    "The document contains unsupported Markdown.",
    422,
  );
}

export function plainText(text: string) {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  if (
    /!\[[^\]]*]\([^)]*\)/.test(markdown) ||
    /(^|\n)\s*<[/!?A-Za-z][^>]*>/.test(markdown) ||
    /^#{3,6}\s/m.test(markdown)
  ) {
    return invalid();
  }

  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (!paragraph.length) return;
    blocks.push({
      type: "paragraph",
      text: plainText(paragraph.join(" ")),
    });
    paragraph = [];
  };

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,2})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2,
        text: plainText(heading[2]),
      });
      continue;
    }
    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      flush();
      blocks.push({ type: "listItem", text: plainText(listItem[1]) });
      continue;
    }
    paragraph.push(line.replace(/^>\s?/, ""));
  }
  flush();

  if (!blocks.length || blocks.some((block) => !block.text)) return invalid();
  return blocks;
}
