import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 } });

test("capture public README screens", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.screenshot({
    path: "docs/images/ideaproof-home.png",
    fullPage: true,
  });

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
  const reviewUrl = page.url();
  await page.screenshot({
    path: "docs/images/ideaproof-review.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Revision history" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(
    page.getByText("Every accepted generation remains available"),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/ideaproof-history.png",
    fullPage: true,
  });
  await page.goto(reviewUrl);
  await expect(page.getByRole("tab", { name: "Specification" })).toBeVisible();
  await page.getByRole("link", { name: "Approve selected revisions" }).click();
  await expect(page).toHaveURL(
    /\/approve\?specificationRevisionId=.+&ndaRevisionId=.+$/,
  );
  await expect(
    page.getByRole("heading", { name: "Lock the exact documents you reviewed." }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/ideaproof-approve.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Approve and create proof" })
    .click();
  await expect(page.getByText("Pending confirmation").first()).toBeVisible();
  await page.screenshot({
    path: "/tmp/ideaproof-proof.png",
    fullPage: true,
  });
});
