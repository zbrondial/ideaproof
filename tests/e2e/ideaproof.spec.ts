import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

test("create, generate, revise, approve, download, and verify", async ({
  page,
}, testInfo) => {
  await page.goto("/projects/new");
  await page
    .getByLabel("Your idea")
    .fill(
      "A local web app that creates concise idea documents and timestamps approved PDFs.",
    );
  await page
    .getByLabel("NDA purpose")
    .fill("Discuss a possible product collaboration.");
  await page.getByRole("button", { name: "Create documents" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/review$/);

  await page.getByRole("tab", { name: "Mutual NDA" }).click();
  await page.getByLabel("What should change?").fill("Use shorter sentences.");
  await page.getByRole("button", { name: "Create revision" }).click();
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
    page.getByText("Mutual NDA").locator("..").getByText("Version 1"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve and create proof" })
    .click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/proof$/);
  await expect(page.getByText("Pending confirmation").first()).toBeVisible();

  await page.getByRole("button", { name: "Check confirmation" }).click();
  await expect(page.getByText("Both proofs are confirmed.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download proof package" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const downloadPath = testInfo.outputPath("ideaproof-package.zip");
  await download.saveAs(downloadPath);
  const archive = unzipSync(new Uint8Array(await readFile(downloadPath)));
  expect(Object.keys(archive).sort()).toEqual([
    "manifest.json",
    "mutual-nda.md",
    "mutual-nda.pdf",
    "mutual-nda.pdf.ots",
    "technical-specification.md",
    "technical-specification.pdf",
    "technical-specification.pdf.ots",
  ]);
  expect(strFromU8(archive["manifest.json"])).not.toContain(
    "e2e-fixture-key",
  );
  const manifest = JSON.parse(strFromU8(archive["manifest.json"]));
  expect(
    manifest.documents.find(
      (document: { type: string }) => document.type === "nda",
    ).revisionId,
  ).toBe(versionOneId);
  expect(strFromU8(archive["mutual-nda.md"])).not.toContain(
    "Revision two uses shorter sentences.",
  );

  await page.goto("/verify");
  await page.getByLabel("PDF document").setInputFiles({
    name: "technical-specification.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(archive["technical-specification.pdf"]),
  });
  await page.getByLabel("OpenTimestamps proof").setInputFiles({
    name: "technical-specification.pdf.ots",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(archive["technical-specification.pdf.ots"]),
  });
  await page.getByRole("button", { name: "Verify exact files" }).click();
  await expect(
    page.getByRole("heading", { name: "Proof confirmed" }),
  ).toBeVisible();
});
