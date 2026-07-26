# IdeaProof Mockup Fidelity and Multi-Provider Design

**Status:** Awaiting written-spec review
**Date:** 2026-07-25

## Purpose

This iteration aligns the implemented IdeaProof application with the supplied
`IdeaProof.dc.html` mockup and adds project-level model selection between
OpenAI and Anthropic.

The mockup is the canonical source for visible composition, screen order,
navigation order, typography, labels, and copy unless a documented exception
below is required for technical accuracy or reflects a later approved product
decision.

The existing local database, revision history, PDF rendering, proof-package
creation, OpenTimestamps integration, and independent verification remain in
place. This is a fidelity retrofit and provider extension, not a rebuild of the
proof workflow.

## Source and Licensing Boundary

The source mockup is:

```text
/Users/zeusbrondial/Downloads/IdeaProod_Design/IdeaProof.dc.html
SHA-256: 815eb9a75b81b4cd65cac6fa3dd2a44d9cc04a9081147ade93ae69e9ab07d0df
```

IdeaProof will independently implement the mockup in React and CSS. It must not
import, copy, bundle, or ship `support.js`, `animations-v2.jsx`,
`tweaks-panel.jsx`, the `x-dc` runtime, or other Omelette scaffolding.

This specification records the durable UI and copy contract so the external
mockup runtime is not required by the published application.

## Fidelity Rule

The implementation must preserve the mockup's:

- dark visual language and restrained blue accent;
- self-hosted IBM Plex Sans and IBM Plex Mono typography, including their
  license and attribution;
- content hierarchy and section order;
- compact controls, borders, spacing rhythm, and responsive behavior;
- screen-specific headings, labels, calls to action, and explanatory copy;
- primary flow from description through proof verification.

Deviations are allowed only when listed under **Approved Accuracy Exceptions**
or when necessary for accessibility. Accessibility changes must preserve the
visible intent.

## Approved Accuracy Exceptions

The following mockup content must not ship unchanged:

1. Remove every claim that ideas are encrypted before storage. IdeaProof does
   not provide application-level encryption.
2. Do not claim that raw intake is included in the timestamp proof record. The
   proof covers the exact approved PDFs.
3. Remove demo proof-state toggles and example project records.
4. Remove Governing Law, jurisdiction, venue, court, forum, and choice-of-law
   clauses from the NDA.
5. Do not invent `IdeaProof Ltd.`, party names, dates, confidentiality periods,
   or other legal facts.
6. Explain that generation sends required content to the selected AI provider.
7. Explain timestamps as evidence for exact approved PDF bytes, not proof of
   ownership, authorship, patent rights, or legal validity.

## Navigation

The desktop navigation order is exactly:

1. clickable IdeaProof logo and wordmark;
2. Proof Logs;
3. Verify proof;
4. How it works;
5. Terms;
6. Protect an idea.

There is no separate Home link. Clicking the IdeaProof logo returns home.

The mobile menu keeps the same order and exposes the current expanded state to
assistive technology.

## Homepage

The homepage removes the current `Local-first idea protection` label.

### Hero

Use the mockup's hero copy and ordering:

```text
Timestamp your idea.
Own the moment it happened.

Turn a software idea into a technical specification and mutual NDA, review
the generated documents, and create a timestamped proof of the exact version
you approved.
```

Actions:

1. Protect an idea
2. Verify a proof

### Five-Step Workflow

Keep the mockup's `How it works` section and `EXAMPLE WORKFLOW` label. Preserve
this order:

1. **Describe your idea** — Describe what you want to build and your preferred
   technology.
2. **Generate your documents** — Receive a technical specification and mutual
   NDA.
3. **Review and revise** — Check both documents and provide feedback if needed.
4. **Approve the documents** — Confirm the technical specification and NDA are
   ready to protect.
5. **Proof created** — Your exact approved PDFs receive OpenTimestamps proofs
   and await confirmation.

The fifth description is an approved accuracy edit. It avoids implying that an
idea or ownership claim is directly protected.

### Trust Notes

Preserve the three-note order and visual treatment:

1. **Stored on this machine** — Your projects and generated documents stay in
   your local IdeaProof data folder. Generation sends the required content to
   your selected AI provider using your API key.
2. **Every revision retained** — All accepted versions are stored. See exactly
   what changed and when feedback was applied.
3. **Proof anyone can verify** — OpenTimestamps proofs let anyone check that an
   exact approved PDF has not changed.

The first note replaces the mockup's encryption claim.

## New Project

The page follows the mockup's narrow, single-column composition and blue accent
treatment.

Heading:

```text
Describe your idea as it exists now.
```

Introductory copy must explain that the inputs become the source for generated
documents without claiming that intake text is directly timestamped.

Replace the mockup's encryption banner with:

```text
Stored on this machine
Your project and generated documents are saved in your local IdeaProof data
folder. Generation sends the required information to your selected AI
provider.
```

The banner uses the mockup's blue-tinted surface and border. Primary form
actions use the same blue accent as `Protect an idea`.

Render these fields in order:

1. Raw software idea — required
2. Preferred technology or target tech stack — optional
3. NDA purpose — required
4. Additional NDA details — optional

The optional NDA help states that Party A, Party B, Effective Date, and
Confidentiality Period remain blank unless the user supplies them.

The primary form action is exactly:

```text
Generate technical specification and sample NDA
```

## One Model Per Project

Each project has one immutable AI provider and model selection. That selection
is used for:

- the initial technical specification;
- the initial mutual NDA;
- every later revision for either document.

This keeps revisions comparable and prevents accidental provider changes
within a project. Comparing providers requires creating a separate project.

### Availability Rules

Provider availability is derived from non-empty server environment variables:

| Configured keys | New Project model choices |
| --- | --- |
| OpenAI only | OpenAI configured model only |
| Anthropic only | Claude configured model only |
| Both | OpenAI and Claude; OpenAI selected by default |
| Neither | No choices; generation disabled with a Setup link |

The control is an accessible radio group or single-choice model picker, not an
on/off toggle.

Only available provider names and configured model names reach the browser.
API-key values remain server-only.

### Environment Variables

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8

IDEAPROOF_DATA_DIR=./data
```

Blank values count as absent.

### Persistence

Add project-level `provider` and `model` fields. The project creation endpoint
accepts only a provider/model pair currently available on the server; it never
accepts arbitrary browser-supplied credentials or model IDs.

Existing projects are migrated to OpenAI and retain the model already recorded
on their earliest revision when available. Existing draft projects without a
revision use the configured OpenAI model. If no OpenAI key exists when an
existing OpenAI project is opened, generation is blocked with a provider-
specific setup message; it does not silently switch the project to Claude.

Every revision records both provider and model. Proof packages use a new
Manifest V2 that adds `provider` while retaining the selected model. Manifest
V1 remains supported for existing packages. No API key or configuration value
appears in a proof package.

## Provider Architecture

The generation service keeps one provider-neutral interface:

```text
prompt + document type + schema
                  |
          project provider/model
             /          \
       OpenAI adapter   Anthropic adapter
             \          /
          validated structured output
```

### OpenAI

The existing server-only Responses API adapter remains available. OpenAI is
the default selection when both providers are configured. The adapter
continues to request schema-constrained output and disables response storage
where supported by the current implementation.

### Anthropic

Add a server-only Anthropic Messages API adapter using the official TypeScript
SDK and Claude structured outputs. The default configured model is
`claude-opus-4-8`.

The adapter maps authentication, rate-limit, refusal, incomplete-output,
invalid-output, and transient provider failures to stable IdeaProof error
codes. Raw provider responses and API keys are not logged or returned.

### Shared Behavior

Both providers receive the same versioned document instructions, user facts,
schema, word ceiling, and prohibited-content rules. Both pass through the same
Zod validation, deterministic Markdown rendering, length enforcement, and NDA
governing-law rejection.

Provider selection does not change the visible document format.

## Generated Document Templates

The supplied mockup documents define the primary visible order.

### Technical Specification

Maximum length: 1,200 words.

1. Product Overview
2. Core Features
3. Technical Architecture
4. API Design
5. Security Considerations

The model must use only supplied facts, state unknowns plainly, and avoid
inventing research, metrics, traction, integrations, or requirements.

### Mutual NDA

Maximum length: 700 words.

1. Title and Not Legal Advice notice
2. Party A and Party B labeled blanks unless supplied
3. Effective Date labeled blank unless supplied
4. Purpose
5. Confidential Information
6. Obligations
7. Exclusions
8. Confidentiality Period labeled blank unless supplied
9. Return or Destruction
10. Signatures

There is no Governing Law section. The additional Exclusions, Return or
Destruction, and Signatures sections preserve the later approved simple-NDA
requirements while retaining the mockup's primary order.

Prompt-template versions and structured-output schemas must be incremented.
Previously generated revisions remain readable and retain their original
prompt version.

## How It Works Page

Add `/how-it-works` and link it from the navigation.

The page uses the mockup's dark product language and presents one responsive,
accessible HTML/CSS flow. A raster diagram is unnecessary because native
content is clearer at different screen sizes, works with assistive technology,
and stays consistent with the rest of the application.

Flow:

1. **Describe** — Enter the idea, NDA purpose, and optional details. The
   project is stored locally.
2. **Choose and generate** — Choose an available model for the project.
   IdeaProof sends the required content to that provider and generates two
   concise documents.
3. **Review and revise** — Read both documents, request changes, and inspect
   saved versions.
4. **Approve exact PDFs** — Choose the exact revisions. IdeaProof creates the
   final PDFs and locks the approval.
5. **Timestamp and verify** — Your PDFs stay on your machine. IdeaProof creates
   an OpenTimestamps proof for each approved PDF, so anyone with the PDF and
   its proof can later verify that the document has not changed.

Visible copy on this page uses `OpenTimestamps` and omits Bitcoin terminology.
The explanation should be calm and direct, without implying that documents are
uploaded to OpenTimestamps or that timestamping proves ownership.

## Remaining Screen Fidelity

The following screens retain their production behavior but are realigned with
the mockup's visible hierarchy, ordering, labels, spacing, and accent usage:

- Proof Logs
- Generating
- Document Review
- Approval confirmation
- Proof Status
- Revision History
- Verify
- Terms
- document preview surfaces

Production data replaces all example records. Real pending, confirmed, failed,
and empty states replace demo switches.

Approval remains a dedicated route rather than a modal so exact selected
revisions can be represented in the URL, refreshed safely, and tested
reliably. Its visual composition should match the mockup's approval dialog.

## OpenTimestamps Boundary

At approval, IdeaProof creates and timestamps two files separately:

1. `technical-specification.pdf`
2. `mutual-nda.pdf`

The OpenTimestamps client hashes each PDF locally and sends a nonce-protected,
opaque commitment to remote calendars. The PDF contents are not uploaded.

Each resulting `.ots` proof binds to the exact corresponding PDF bytes.
Changing any PDF byte makes that proof fail verification.

The original intake, prompts, revision feedback, Markdown files, API keys,
SQLite database, manifest, and ZIP package are not directly timestamped.

The product UI summarizes this as:

```text
Your PDFs stay on your machine. IdeaProof creates an OpenTimestamps proof for
each approved PDF, so anyone with the PDF and its proof can later verify that
the document has not changed.
```

## Error Handling and Setup

The Setup page reports:

- OpenAI configured or missing;
- Anthropic configured or missing;
- at least one model provider available;
- writable local data directory;
- supported Python runtime;
- project-local OpenTimestamps client.

Provider-specific generation failures use safe, actionable messages without
exposing credentials, prompts, raw responses, or filesystem paths.

If a project's fixed provider becomes unavailable, the project remains
readable. Only new generation and revision actions are disabled until its key
is restored.

## Testing and Acceptance

### Mockup Fidelity

- Compare every production screen with the canonical mockup.
- Verify homepage copy, section order, typography, accent color, and navigation
  order exactly.
- Verify the Home link is absent and the wordmark returns home.
- Verify the homepage has no `Local-first idea protection` label.
- Verify the New Project banner contains no encryption claim.
- Verify desktop and 375-pixel mobile layouts have no clipping.
- Verify keyboard, focus, and reduced-motion behavior.

### Provider Selection

- Test all four API-key availability combinations.
- Test OpenAI as the default when both providers are available.
- Test that browser-supplied unavailable providers and model IDs are rejected.
- Test that one provider/model is fixed for the project and every revision.
- Run the same schema, word-limit, shortening, prohibited-content, and
  injection-resistance tests against both adapters.
- Test provider-specific authentication, rate-limit, refusal, malformed
  output, and transient errors.

### End-to-End

- Complete the full create, generate, revise, approve, download, and verify
  flow using deterministic OpenAI fixtures.
- Repeat the same flow using deterministic Anthropic fixtures.
- Confirm provider and model appear in revision metadata and the manifest.
- Confirm neither API key appears in HTML, JSON responses, SQLite, logs,
  screenshots, PDFs, `.ots` files, or ZIP packages.
- Re-run deterministic PDF tests and visual inspection.

## Documentation

Update README, `.env.example`, Setup, Terms, and third-party notices to explain:

- OpenAI is selected by default when both providers are configured;
- the user chooses one model per project;
- Claude Opus 4.8 support and its environment variables;
- what content is sent to the selected provider;
- what stays local;
- exactly which PDFs receive OpenTimestamps proofs;
- the approved PDFs stay local while OpenTimestamps creates verification
  proofs for them;
- timestamps do not prove ownership or legal validity.

## Out of Scope

- application-level encryption;
- changing providers within an existing project;
- separate providers for the specification and NDA;
- provider comparison inside one project;
- user-supplied API keys through the browser;
- hosted accounts, authentication, synchronization, or collaboration;
- generated raster diagrams for How It Works;
- timestamping the ZIP package, manifest, intake form, or Markdown files;
- copying or distributing the mockup runtime.
