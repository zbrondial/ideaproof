import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 } });

test("capture public README screens", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.screenshot({
    path: "docs/images/ideaproof-home.png",
    fullPage: true,
  });

  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "Proof Logs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your ideas, generated documents, and proof status."),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/ideaproof-logs.png",
    fullPage: true,
  });

  await page.goto("/projects/new");
  await page.getByLabel("Idea name").fill("IdeaProof");
  await page.getByLabel("Owner’s full name").fill("Ada Lovelace");
  await page
    .getByLabel("Raw software idea")
    .fill(
      "A local web app that creates concise idea documents and timestamps approved PDFs.",
    );
  await page
    .getByLabel("NDA purpose")
    .fill("Discuss a possible product collaboration.");
  let releaseSpecification!: () => void;
  const specificationPaused = new Promise<void>((resolve) => {
    releaseSpecification = resolve;
  });
  await page.route("**/generate/specification", async (route) => {
    await specificationPaused;
    await route.continue();
  });
  await page
    .getByRole("button", {
      name: "Generate technical specification and sample NDA",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Preparing your documents" }),
  ).toBeVisible();
  await expect(page.getByText("OpenAI · gpt-5.6")).toBeVisible();
  for (const step of [
    "Organizing product requirements",
    "Generating technical specification",
    "Generating sample NDA",
    "Saving document revisions",
  ]) {
    await expect(page.getByText(step)).toBeVisible();
  }
  await page.screenshot({
    path: "/tmp/ideaproof-generating.png",
    fullPage: true,
  });
  releaseSpecification();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/review$/);
  await page.unroute("**/generate/specification");
  const reviewUrl = page.url();
  await expect(
    page.getByRole("heading", { name: "Review your documents" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Technical specification" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sample NDA" })).toBeVisible();
  await expect(page.getByLabel("Version")).toBeVisible();
  await expect(page.getByLabel("Request changes")).toBeVisible();
  await expect(
    page.getByText("Prepared and claimed by:"),
  ).toBeVisible();
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByText(/demo/i)).toHaveCount(0);
  await page.screenshot({
    path: "docs/images/ideaproof-review.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Project history" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(
    page.getByRole("heading", { name: "Project history" }),
  ).toBeVisible();
  await expect(
    page.getByText("Idea updates and generated documents remain available"),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/ideaproof-history.png",
    fullPage: true,
  });
  await page.goto(reviewUrl);
  await expect(
    page.getByRole("tab", { name: "Technical specification" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Approve selected revisions" }).click();
  await expect(page).toHaveURL(
    /\/approve\?specificationRevisionId=.+&ndaRevisionId=.+$/,
  );
  await expect(
    page.getByRole("heading", { name: "Approve these documents?" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/ideaproof-approve.png",
    fullPage: true,
  });
  await page
    .getByRole("checkbox", {
      name: "I confirm that I prepared and claim ownership of this documented idea.",
    })
    .check();
  await page
    .getByRole("button", { name: "Approve and create proof" })
    .click();
  await expect(page.getByText("Pending confirmation").first()).toBeVisible();
  const proofUrl = page.url();
  await page.screenshot({
    path: "/tmp/ideaproof-proof.png",
    fullPage: true,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of [
    "/",
    "/projects",
    "/projects/new",
    "/verify",
    "/how-it-works",
    "/terms",
    "/setup",
    reviewUrl,
    proofUrl,
  ]) {
    await page.goto(url);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
      `${url} should not overflow at 375px`,
    ).toBe(false);
  }

  await page.goto("/");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("link", { name: "How it works" }),
  ).toBeVisible();

  // A 720 CSS-pixel viewport approximates a 1440px desktop at 200% zoom.
  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Timestamp your idea/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
