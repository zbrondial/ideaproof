import { readFile } from "node:fs/promises";
import { join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, rgb } from "pdf-lib";

import { parseMarkdown } from "./markdown";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 58;

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/u)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderPdf(input: {
  title: string;
  markdown: string;
  approvedAt: string;
  documentType: "specification" | "nda";
}): Promise<Uint8Array> {
  const fontDirectory = join(process.cwd(), "assets", "fonts");
  const [regularBytes, semiboldBytes] = await Promise.all([
    readFile(join(fontDirectory, "IBMPlexSans-Regular.ttf")),
    readFile(join(fontDirectory, "IBMPlexSans-SemiBold.ttf")),
  ]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const regular = await document.embedFont(regularBytes, { subset: true });
  const semibold = await document.embedFont(semiboldBytes, { subset: true });
  const approvedDate = new Date(input.approvedAt);
  document.setTitle(input.title);
  document.setAuthor("IdeaProof");
  document.setSubject(
    input.documentType === "nda"
      ? "Approved mutual NDA"
      : "Approved technical specification",
  );
  document.setCreator("IdeaProof");
  document.setProducer("IdeaProof");
  document.setCreationDate(approvedDate);
  document.setModificationDate(approvedDate);

  const createPage = () => {
    const createdPage = document.addPage([PAGE.width, PAGE.height]);
    createdPage.drawText("IDEAPROOF", {
      x: MARGIN,
      y: 28,
      size: 7,
      font: semibold,
      color: rgb(0.38, 0.42, 0.48),
    });
    return createdPage;
  };
  let page = createPage();
  let y = PAGE.height - MARGIN;

  for (const block of parseMarkdown(input.markdown)) {
    const style =
      block.type === "heading"
        ? block.level === 1
          ? { font: semibold, size: 22, leading: 29, before: 6, after: 16 }
          : { font: semibold, size: 14, leading: 20, before: 16, after: 8 }
        : {
            font: regular,
            size: 10.5,
            leading: 16,
            before: 3,
            after: block.type === "listItem" ? 3 : 9,
          };
    const text = block.type === "listItem" ? `•  ${block.text}` : block.text;
    const lines = wrap(
      text,
      style.font,
      style.size,
      PAGE.width - MARGIN * 2,
    );
    if (y - style.before - lines.length * style.leading < MARGIN + 25) {
      page = createPage();
      y = PAGE.height - MARGIN;
    }
    y -= style.before;
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN,
        y: y - style.size,
        size: style.size,
        font: style.font,
        color: rgb(0.12, 0.14, 0.18),
      });
      y -= style.leading;
    }
    y -= style.after;
  }

  const pages = document.getPages();
  pages.forEach((item, index) => {
    item.drawText(`${index + 1} / ${pages.length}`, {
      x: PAGE.width - MARGIN - 24,
      y: 28,
      size: 7,
      font: regular,
      color: rgb(0.38, 0.42, 0.48),
    });
  });
  return document.save({
    addDefaultPage: false,
    useObjectStreams: false,
    updateFieldAppearances: false,
  });
}
