import { writeFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";
import { expect, it } from "vitest";

import { renderPdf } from "@/server/documents/pdf";

it("renders identical bytes for identical approved input", async () => {
  const input = {
    title: "Technical Specification",
    markdown: "# Technical Specification\n\nA concise local proof application.",
    approvedAt: "2026-07-25T00:00:00.000Z",
    documentType: "specification" as const,
  };

  const first = await renderPdf(input);
  expect(first).toEqual(await renderPdf(input));
  if (process.env.IDEAPROOF_PDF_SAMPLE) {
    writeFileSync(process.env.IDEAPROOF_PDF_SAMPLE, first);
  }
});

it("renders labeled NDA blanks as ordinary visible text", async () => {
  const pdf = await renderPdf({
    title: "Sample Non-Disclosure Agreement",
    markdown:
      "# Sample Non-Disclosure Agreement\n\nParty A: ______________________",
    approvedAt: "2026-07-25T00:00:00.000Z",
    documentType: "nda",
  });

  expect(pdf.byteLength).toBeGreaterThan(1_000);
});

it("renders Unicode text with the embedded font", async () => {
  const pdf = await renderPdf({
    title: "Unicode Specification",
    markdown:
      "# Unicode Specification\n\nJosé's café supports naïve résumé imports.",
    approvedAt: "2026-07-25T00:00:00.000Z",
    documentType: "specification",
  });

  expect(pdf.byteLength).toBeGreaterThan(1_000);
});

it("creates additional pages for long canonical content", async () => {
  const paragraphs = Array.from(
    { length: 80 },
    (_, index) =>
      `Paragraph ${index + 1} describes a concise implementation decision with enough text to exercise fixed page breaks.`,
  ).join("\n\n");
  const pdf = await renderPdf({
    title: "Multipage Specification",
    markdown: `# Multipage Specification\n\n${paragraphs}`,
    approvedAt: "2026-07-25T00:00:00.000Z",
    documentType: "specification",
  });

  expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
});
