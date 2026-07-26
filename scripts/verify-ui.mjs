import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

for (const [name, path] of [
  ["home", "/"],
  ["new-project", "/projects/new"],
  ["proof-logs", "/projects"],
  ["verify", "/verify"],
  ["setup", "/setup"],
  ["terms", "/terms"],
]) {
  const response = await page.goto(`http://127.0.0.1:3000${path}`, {
    waitUntil: "networkidle",
  });
  if (!response?.ok()) throw new Error(`${path} returned ${response?.status()}`);
  if (!(await page.locator("body").innerText()).trim()) {
    throw new Error(`${path} rendered a blank page`);
  }
  if (await page.locator("[data-nextjs-dialog]").count()) {
    throw new Error(`${path} rendered a Next.js error overlay`);
  }
  await page.screenshot({
    path: `/tmp/ideaproof-${name}.png`,
    fullPage: true,
  });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
const menu = page.getByRole("button", { name: "Menu" });
await menu.click();
if ((await menu.getAttribute("aria-expanded")) !== "true") {
  throw new Error("Mobile menu did not expose its open state");
}
await page.screenshot({
  path: "/tmp/ideaproof-home-mobile.png",
  fullPage: true,
});
await page.goto("http://127.0.0.1:3000/verify", { waitUntil: "networkidle" });
await page.screenshot({
  path: "/tmp/ideaproof-verify-mobile.png",
  fullPage: true,
});

await browser.close();
if (errors.length) throw new Error(`Browser console errors: ${errors.join("; ")}`);
console.log(
  "UI verified: home, intake, proof logs, verify, setup, terms, and mobile navigation",
);
