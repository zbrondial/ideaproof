import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import TermsPage from "@/app/terms/page";
import VerifyPage from "@/app/verify/page";
import { ApprovalButton } from "@/components/approval-button";
import { AppNav } from "@/components/app-nav";
import { GenerationProgress } from "@/components/generation-progress";
import { IdeaEditor } from "@/components/idea-editor";
import { ProofStatus } from "@/components/proof-status";
import { ProjectForm } from "@/components/project-form";
import { ReviewWorkspace } from "@/components/review-workspace";
import { StatusBadge } from "@/components/status-badge";

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
  expect(html).toContain("Mark the moment it happened.");
  expect(html).toContain(
    "Create a technical specification, sample NDA, and timestamped proof.",
  );
  expect(html).not.toContain("Local-first idea protection");
  expect(html).toContain("Timestamp an idea");
  expect(html).not.toMatch(/\bprotect\b/i);
  expect(html).toContain("sample NDA");
  expect(html).not.toMatch(/mutual NDA|Mutual Non-Disclosure Agreement/i);
  expect(html.indexOf("Proof Logs")).toBeLessThan(
    html.indexOf("Verify proof"),
  );
  expect(html.indexOf("Verify proof")).toBeLessThan(
    html.indexOf("How it works"),
  );
  expect(html.indexOf("How it works")).toBeLessThan(html.indexOf("Terms"));
  expect(html).not.toMatch(/>Home</);
});

it("keeps the timestamp action out of the primary navigation", () => {
  const html = renderToStaticMarkup(<AppNav />);

  expect(html).not.toContain("Timestamp an idea");
  expect(html).not.toContain('href="/projects/new"');
});

it("does not describe an embedded timestamp as independently verified", () => {
  const html = renderToStaticMarkup(<StatusBadge status="confirmed" />);

  expect(html).toContain("Timestamp complete");
  expect(html).not.toContain(">Confirmed<");
});

it("renders the approved digital-fingerprint explanation", async () => {
  const { default: HowItWorksPage } = await import(
    "@/app/how-it-works/page"
  );
  const html = renderToStaticMarkup(<HowItWorksPage />);

  expect(html).toContain("digital fingerprint of each approved PDF");
  expect(html).toContain("Your idea is stored locally.");
  expect(html).not.toContain("Your project is stored locally.");
  expect(html).toContain("Your PDFs stay on your machine");
  expect(html).toContain("Timestamp an idea");
  expect(html).not.toMatch(/\bprotect\b/i);
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
  expect(both).toContain(
    "Generate technical specification and sample NDA",
  );
  expect(both).not.toMatch(/mutual NDA|Mutual Non-Disclosure Agreement/i);
  expect(both).toContain('<label for="ideaName">Idea name</label>');
  expect(both).toContain("Use a short working name.");
  expect(both).toContain('<label for="ownerName">Owner’s full name</label>');
  expect(both).toContain(
    "This name appears on the technical specification and becomes part of its timestamped PDF.",
  );

  const none = renderToStaticMarkup(<ProjectForm providers={[]} />);
  expect(none).toContain("Set up an AI provider");
  expect(none).toContain('href="/setup"');
  expect(none).toContain("disabled");
});

it("uses plain approval and proof actions", () => {
  const approval = renderToStaticMarkup(
    <ApprovalButton
      projectId="project-id"
      specificationRevisionId="spec-id"
      ndaRevisionId="nda-id"
      requiresOwnershipConfirmation
    />,
  );
  expect(approval).toContain("Approve and create proof");
  expect(approval).toContain("Keep reviewing");
  expect(approval).toContain(
    "I confirm that I prepared and claim ownership of this documented idea.",
  );
  expect(approval).toContain("disabled");

  const proof = renderToStaticMarkup(
    <ProofStatus
      projectId="project-id"
      initialStatus="pending"
      specificationRevisionId="spec-id"
      ndaRevisionId="nda-id"
    />,
  );
  expect(proof).toContain("Check confirmation");
  expect(proof).toContain("Download proof package");
  expect(proof).not.toContain('href="/verify"');
  expect(proof).not.toContain(">Verify proof</");
});

it("offers local idea editing before approval", () => {
  const html = renderToStaticMarkup(
    <IdeaEditor
      projectId="project-id"
      ideaName="IdeaProof"
      idea="A local app that timestamps concise idea documents."
    />,
  );

  expect(html).toContain("Edit idea details");
  expect(html).toContain('<label for="editIdeaName">Idea name</label>');
  expect(html).toContain('<label for="editIdea">Raw software idea</label>');
  expect(html).toContain("Update note");
  expect(html).toContain("Optional");
  expect(html).toContain("Save idea update");
});

it("requires regeneration when selected documents use an older idea", () => {
  const revisions = (["specification", "nda"] as const).map(
    (documentType, index) => ({
      id: `${documentType}-id`,
      projectId: "project-id",
      ideaVersionId: "idea-v1",
      documentType,
      version: 1,
      content: "# Document",
      wordCount: 1,
      feedback: null,
      promptTemplateVersion:
        documentType === "specification" ? "spec-v5" : "nda-v5",
      provider: "openai" as const,
      model: "gpt-5.6",
      providerResponseId: `resp-${index}`,
      createdAt: "2026-07-27T00:00:00.000Z",
    }),
  );
  const stale = renderToStaticMarkup(
    <ReviewWorkspace
      projectId="project-id"
      revisions={revisions}
      initialSpecificationId="specification-id"
      initialNdaId="nda-id"
      currentIdeaVersionId="idea-v2"
    />,
  );
  expect(stale).toContain(
    "Your idea changed after these documents were generated.",
  );
  expect(stale).not.toContain("Approve selected revisions");

  const current = renderToStaticMarkup(
    <ReviewWorkspace
      projectId="project-id"
      revisions={revisions}
      initialSpecificationId="specification-id"
      initialNdaId="nda-id"
      currentIdeaVersionId="idea-v1"
    />,
  );
  expect(current).toContain("Approve selected revisions");

  const regeneration = renderToStaticMarkup(
    <GenerationProgress
      projectId="project-id"
      provider="openai"
      model="gpt-5.6"
      autoStart={false}
      onComplete="refresh"
    />,
  );
  expect(regeneration).toContain(
    "Regenerate both documents · 2 AI requests",
  );
});

it("explains verification and important limits in plain language", () => {
  const verify = renderToStaticMarkup(<VerifyPage />);
  expect(verify).toContain("<h1>Verify proof</h1>");
  expect(verify).toContain("PDF file");
  expect(verify).toContain("OpenTimestamps proof");
  expect(verify).toContain(">Verify proof</button>");

  const terms = renderToStaticMarkup(<TermsPage />);
  expect(terms).toContain("selected AI provider");
  expect(terms).toContain("sample NDA");
  expect(terms).toContain("not legal advice");
  expect(terms).toContain("without application-level encryption");
  expect(terms).toContain(
    "A confirmed OpenTimestamps proof shows that an exact approved PDF existed by a certain time.",
  );
  expect(terms).toContain(
    "The technical-specification PDF includes its prepared-and-claimed-by declaration.",
  );
  expect(terms).toContain(
    "The timestamp does not independently verify the declarant’s identity or resolve competing ownership claims.",
  );
});
