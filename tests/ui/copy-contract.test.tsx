import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { AppNav } from "@/components/app-nav";
import { ProjectForm } from "@/components/project-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

it("renders the canonical homepage and navigation copy in order", () => {
  const html = renderToStaticMarkup(
    <>
      <AppNav />
      <HomePage />
    </>,
  );

  expect(html).toContain("Timestamp your <span>idea</span>.");
  expect(html).toContain("Own the moment it happened.");
  expect(html).not.toContain("Local-first idea protection");
  expect(html.indexOf("Proof Logs")).toBeLessThan(
    html.indexOf("Verify proof"),
  );
  expect(html.indexOf("Verify proof")).toBeLessThan(
    html.indexOf("How it works"),
  );
  expect(html.indexOf("How it works")).toBeLessThan(html.indexOf("Terms"));
  expect(html).not.toMatch(/>Home</);
});

it("renders the approved digital-fingerprint explanation", async () => {
  const { default: HowItWorksPage } = await import(
    "@/app/how-it-works/page"
  );
  const html = renderToStaticMarkup(<HowItWorksPage />);

  expect(html).toContain("digital fingerprint of each approved PDF");
  expect(html).toContain("Your PDFs stay on your machine");
  expect(html).not.toMatch(/Bitcoin|opaque commitment|blockchain/i);
});

it("shows only configured models and defaults to OpenAI when both are available", () => {
  const both = renderToStaticMarkup(
    <ProjectForm
      providers={[
        { provider: "openai", model: "gpt-5.6", label: "OpenAI — gpt-5.6" },
        {
          provider: "anthropic",
          model: "claude-opus-4-8",
          label: "Claude — claude-opus-4-8",
        },
      ]}
    />,
  );
  expect(both).toMatch(
    /<input(?=[^>]*name="provider")(?=[^>]*value="openai")(?=[^>]*checked="")[^>]*>/,
  );
  expect(both).toContain("Claude — claude-opus-4-8");

  const none = renderToStaticMarkup(<ProjectForm providers={[]} />);
  expect(none).toContain("Set up an AI provider");
  expect(none).toContain('href="/setup"');
  expect(none).toContain("disabled");
});
