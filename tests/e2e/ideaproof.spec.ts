import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

for (const provider of [
  {
    name: "OpenAI",
    label: "OpenAI — gpt-5.6",
    provider: "openai",
    model: "gpt-5.6",
  },
  {
    name: "Claude",
    label: "Claude — claude-opus-4-8",
    provider: "anthropic",
    model: "claude-opus-4-8",
  },
] as const) {
  test(`create, revise, approve, and verify with ${provider.name}`, async ({
    page,
  }, testInfo) => {
  await page.goto("/projects/new");
  await page.getByLabel(provider.label).check();
  await page.getByLabel("Owner’s full name").fill("Ada Lovelace");
  await page
    .getByLabel("Raw software idea")
    .fill(
      "A local web app that creates concise idea documents and timestamps approved PDFs.",
    );
  await page
    .getByLabel("NDA purpose")
    .fill("Discuss a possible product collaboration.");
  await page
    .getByRole("button", {
      name: "Generate technical specification and sample NDA",
    })
    .click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/review$/);

  await page.getByRole("tab", { name: "Sample NDA" }).click();
  await page.getByLabel("Request changes").fill("Use shorter sentences.");
  await page
    .getByRole("button", { name: "Generate updated version" })
    .click();
  await expect(page.locator("select option:checked")).toHaveText(/Version 2/);
  const versionOneId = await page
    .locator("select option")
    .filter({ hasText: "Version 1" })
    .getAttribute("value");
  expect(versionOneId).toBeTruthy();
  await page.locator("select").selectOption(versionOneId!);
  await expect(page.locator("select option:checked")).toHaveText(/Version 1/);

  await page.getByRole("link", { name: "Approve selected revisions" }).click();
  await expect(
    page.getByText("Sample NDA").locator("..").getByText("Version 1"),
  ).toBeVisible();
  await expect(
    page.getByText("Prepared and claimed by:").locator(".."),
  ).toContainText("Ada Lovelace");
  const ownershipConfirmation = page.getByRole("checkbox", {
    name: "I confirm that I prepared and claim ownership of this documented idea.",
  });
  await expect(ownershipConfirmation).not.toBeChecked();
  await ownershipConfirmation.check();
  await page
    .getByRole("button", { name: "Approve and create proof" })
    .click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/proof$/);
  await expect(page.getByText("Pending confirmation").first()).toBeVisible();
  const projectId = new URL(page.url()).pathname.split("/")[2];
  const main = page.locator("main");
  await expect(main.getByText("Proof record", { exact: true })).toHaveCount(0);
  await expect(
    main.getByRole("heading", { name: "Timestamped documents" }),
  ).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "Exact revisions in this proof" }),
  ).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Verify proof" })).toHaveCount(0);
  await expect(
    main.getByRole("link", { name: "Project history" }),
  ).toHaveAttribute("href", `/projects/${projectId}/history`);
  await expect(page.locator(".timestamp-copy > span")).toHaveCount(2);

  let releaseProofCheck!: () => void;
  const proofCheckPaused = new Promise<void>((resolve) => {
    releaseProofCheck = resolve;
  });
  await page.route("**/proof/check", async (route) => {
    await proofCheckPaused;
    await route.continue();
  });
  await page.getByRole("button", { name: "Check confirmation" }).click();
  await expect(
    page.getByText(
      "Checking whether OpenTimestamps has confirmed the digital fingerprints of both PDFs…",
    ),
  ).toBeVisible();
  releaseProofCheck();
  await expect(page.getByText("Both proofs are confirmed.")).toBeVisible();
  await page.unroute("**/proof/check");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download proof package" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const downloadPath = testInfo.outputPath("ideaproof-package.zip");
  await download.saveAs(downloadPath);
  const archive = unzipSync(new Uint8Array(await readFile(downloadPath)));
  expect(Object.keys(archive).sort()).toEqual([
    "manifest.json",
    "sample-nda.md",
    "sample-nda.pdf",
    "sample-nda.pdf.ots",
    "technical-specification.md",
    "technical-specification.pdf",
    "technical-specification.pdf.ots",
  ]);
  expect(strFromU8(archive["manifest.json"])).not.toContain(
    "e2e-fixture-key",
  );
  const manifest = JSON.parse(strFromU8(archive["manifest.json"]));
  expect(manifest.schemaVersion).toBe(2);
  expect(
    manifest.documents.find(
      (document: { type: string }) => document.type === "nda",
    ),
  ).toMatchObject({
    markdownFile: "sample-nda.md",
    pdfFile: "sample-nda.pdf",
    proofFile: "sample-nda.pdf.ots",
  });
  expect(manifest.documents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        provider: provider.provider,
        model: provider.model,
      }),
    ]),
  );
  expect(
    manifest.documents.every(
      (document: { provider: string; model: string }) =>
        document.provider === provider.provider &&
        document.model === provider.model,
    ),
  ).toBe(true);
  expect(
    manifest.documents.find(
      (document: { type: string }) => document.type === "nda",
    ).revisionId,
  ).toBe(versionOneId);
  expect(strFromU8(archive["sample-nda.md"])).not.toContain(
    "Revision two uses shorter sentences.",
  );
  const approvedSpecification = strFromU8(
    archive["technical-specification.md"],
  );
  expect(approvedSpecification).toContain(
    "**Prepared and claimed by:** Ada Lovelace",
  );
  expect(
    approvedSpecification.match(/Prepared and claimed by/g),
  ).toHaveLength(1);

  await page.goto("/verify");
  await page.getByLabel("PDF file").setInputFiles({
    name: "technical-specification.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(archive["technical-specification.pdf"]),
  });
  await page.getByLabel("OpenTimestamps proof").setInputFiles({
    name: "technical-specification.pdf.ots",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(archive["technical-specification.pdf.ots"]),
  });
  await page.getByRole("button", { name: "Verify proof" }).click();
  await expect(
    page.getByRole("heading", { name: "Proof confirmed" }),
  ).toBeVisible();
  });
}
