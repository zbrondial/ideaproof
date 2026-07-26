# IdeaProof Fidelity and Multi-Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align IdeaProof with the canonical mockup and add one fixed OpenAI or Claude model per project without rebuilding the working local proof workflow.

**Architecture:** Retain the existing Next.js, SQLite, deterministic PDF, OpenTimestamps, and ZIP-package layers. Add a small provider catalog and two server-only generation adapters behind the existing structured-output port, persist the chosen provider/model on each project, and retrofit the React/CSS surfaces to the canonical mockup. Use native HTML/CSS for the How It Works diagram and add only Anthropic's official SDK.

**Tech Stack:** Next.js 16.2.11, React 19.2.8, TypeScript 6.0.3, Node.js 24 SQLite, Zod 4.4.3, OpenAI SDK 6.49.0, `@anthropic-ai/sdk` 0.115.0, Vitest 4.1.10, Playwright 1.62.0, PDF-Lib, OpenTimestamps client.

## Global Constraints

- Canonical mockup: `/Users/zeusbrondial/Downloads/IdeaProod_Design/IdeaProof.dc.html`, SHA-256 `815eb9a75b81b4cd65cac6fa3dd2a44d9cc04a9081147ade93ae69e9ab07d0df`.
- Do not import, copy, bundle, or ship the mockup runtime or its support files.
- Use self-hosted IBM Plex Sans and IBM Plex Mono with the existing OFL attribution.
- Navigation order: IdeaProof logo, Proof Logs, Verify proof, How it works, Terms, Protect an idea. No Home link.
- OpenAI is selected by default when both provider keys are configured.
- A project's provider and model never change after creation.
- Technical specifications are at most 1,000 words.
- Sample NDAs are at most 700 words and contain no governing-law, jurisdiction, venue, court, forum, or choice-of-law clause.
- Primary intake action: `Generate technical specification and sample NDA`.
- User-facing OpenTimestamps copy says `digital fingerprint of each approved PDF`; omit Bitcoin terminology from How It Works.
- API keys remain server-only and must never enter HTML, JSON responses, SQLite, logs, screenshots, PDFs, proof files, or ZIP packages.
- Preserve direct local installation as the primary workflow; Docker remains optional.
- Every non-trivial change follows red-green-refactor and ends with a focused commit.

---

### Task 1: Provider Configuration and Setup Availability

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `server/config.ts`
- Modify: `app/api/setup/route.ts`
- Modify: `components/setup-checks.tsx`
- Modify: `tests/config.test.ts`
- Modify: `tests/api/setup.test.ts`

**Interfaces:**
- Produces: `AiProvider`, `ProviderSummary`, `listConfiguredProviders()`, and `requireProviderConfig(provider, model)`.
- Consumes: existing storage configuration from `loadStorageConfig()`.

- [ ] **Step 1: Install the one required provider dependency**

Run:

```bash
npm install @anthropic-ai/sdk@0.115.0
```

Expected: `package.json` and `package-lock.json` pin `@anthropic-ai/sdk` at `0.115.0`.

- [ ] **Step 2: Write failing provider configuration tests**

Add cases to `tests/config.test.ts`:

```ts
it("lists only configured providers without returning keys", () => {
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.OPENAI_MODEL = "gpt-5.6";
  delete process.env.ANTHROPIC_API_KEY;

  expect(listConfiguredProviders()).toEqual([
    { provider: "openai", model: "gpt-5.6", label: "OpenAI — gpt-5.6" },
  ]);
  expect(JSON.stringify(listConfiguredProviders())).not.toContain(
    "openai-test-key",
  );
});

it("orders OpenAI before Claude when both are configured", () => {
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.ANTHROPIC_API_KEY = "anthropic-test-key";
  delete process.env.ANTHROPIC_MODEL;

  expect(listConfiguredProviders()).toEqual([
    { provider: "openai", model: "gpt-5.6", label: "OpenAI — gpt-5.6" },
    {
      provider: "anthropic",
      model: "claude-opus-4-8",
      label: "Claude — claude-opus-4-8",
    },
  ]);
});

it("rejects provider and model pairs not configured on the server", () => {
  process.env.ANTHROPIC_API_KEY = "anthropic-test-key";
  process.env.ANTHROPIC_MODEL = "claude-opus-4-8";

  expect(() =>
    requireProviderConfig("anthropic", "claude-other"),
  ).toThrowError(expect.objectContaining({ code: "SETUP_MODEL_UNAVAILABLE" }));
});
```

Update `tests/api/setup.test.ts` to assert separate OpenAI and Anthropic checks plus `SETUP_PROVIDER_READY`.

- [ ] **Step 3: Run the focused tests and verify failure**

Run:

```bash
npx vitest run tests/config.test.ts tests/api/setup.test.ts
```

Expected: FAIL because provider catalog functions and Anthropic setup checks do not exist.

- [ ] **Step 4: Implement the minimal provider catalog**

In `server/config.ts`, add:

```ts
export type AiProvider = "openai" | "anthropic";

export type ProviderSummary = {
  provider: AiProvider;
  model: string;
  label: string;
};

type ProviderConfig = ProviderSummary & { apiKey: string };

export function listConfiguredProviders(): ProviderSummary[] {
  const providers: ProviderSummary[] = [];
  if (process.env.OPENAI_API_KEY?.trim()) {
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
    providers.push({ provider: "openai", model, label: `OpenAI — ${model}` });
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    const model =
      process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-8";
    providers.push({
      provider: "anthropic",
      model,
      label: `Claude — ${model}`,
    });
  }
  return providers;
}

export function requireProviderConfig(
  provider: AiProvider,
  model: string,
): ProviderConfig {
  const available = listConfiguredProviders().find(
    (item) => item.provider === provider && item.model === model,
  );
  if (!available) {
    throw new AppError(
      "SETUP_MODEL_UNAVAILABLE",
      "Restore the API key and model configured for this project.",
      503,
    );
  }
  return {
    ...available,
    apiKey:
      provider === "openai"
        ? process.env.OPENAI_API_KEY!.trim()
        : process.env.ANTHROPIC_API_KEY!.trim(),
  };
}
```

Remove the OpenAI-only `loadConfig()` requirement after its callers move in Task 3. Keep `loadStorageConfig()` unchanged.

Update `.env.example`:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8
IDEAPROOF_DATA_DIR=./data
```

Update `handleSetup()` to return OpenAI, Anthropic, and overall-provider checks without values. Update `SetupChecks` copy to display those checks.

- [ ] **Step 5: Run focused and regression checks**

Run:

```bash
npx vitest run tests/config.test.ts tests/api/setup.test.ts
npm run typecheck
```

Expected: PASS with no API-key value in serialized results.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example server/config.ts app/api/setup/route.ts components/setup-checks.tsx tests/config.test.ts tests/api/setup.test.ts
git commit -m "feat: detect configured AI providers"
```

---

### Task 2: Persist One Provider and Model Per Project

**Files:**
- Create: `server/db/migrations/002-project-provider.sql`
- Modify: `server/db/projects.ts`
- Modify: `tests/db/projects.test.ts`
- Modify: `tests/api/generation-harness.ts`
- Modify: `tests/helpers/open-test-store.ts`

**Interfaces:**
- Consumes: `AiProvider` from `server/config.ts`.
- Produces: project fields `provider: AiProvider` and `model: string`; revision fields `provider` and `providerResponseId`.
- Database compatibility: existing projects become OpenAI projects; existing response IDs remain intact.

- [ ] **Step 1: Write failing migration and persistence tests**

Add to `tests/db/projects.test.ts`:

```ts
it("stores one provider and model for the project and its revisions", () => {
  const store = openTestStore();
  const project = store.createProject({
    idea: "A local tool that proves exact generated idea documents.",
    technologyPreference: "Next.js",
    ndaPurpose: "Evaluate a possible collaboration",
    ndaDetails: "",
    provider: "anthropic",
    model: "claude-opus-4-8",
  });
  const revision = store.addRevision({
    projectId: project.id,
    documentType: "specification",
    content: "# Product Overview\n\nFixture",
    wordCount: 3,
    feedback: null,
    promptTemplateVersion: "spec-v2",
    provider: project.provider,
    model: project.model,
    providerResponseId: "msg_fixture",
  });

  expect(store.getProject(project.id)).toMatchObject({
    provider: "anthropic",
    model: "claude-opus-4-8",
  });
  expect(revision).toMatchObject({
    provider: "anthropic",
    model: "claude-opus-4-8",
    providerResponseId: "msg_fixture",
  });
});
```

Add a migration fixture test that opens a version-1 database with an OpenAI revision and asserts the migrated project uses that revision's model.

Build the fixture explicitly before opening it through the current store:

```ts
const legacy = new DatabaseSync(databasePath);
legacy.exec(readFileSync("server/db/migrations/001-initial.sql", "utf8"));
legacy
  .prepare(
    `INSERT INTO projects
       (id, title, idea, technology_preference, nda_purpose, nda_details,
        status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
  )
  .run(
    projectId,
    "Legacy idea",
    "A legacy locally stored idea",
    "",
    "Evaluation",
    "",
    now,
    now,
  );
legacy
  .prepare(
    `INSERT INTO revisions
       (id, project_id, document_type, version, content, word_count, feedback,
        prompt_template_version, model, openai_response_id, created_at)
     VALUES (?, ?, 'specification', 1, ?, 3, NULL, ?, ?, ?, ?)`,
  )
  .run(revisionId, projectId, "# Legacy\n\nDocument", "spec-v1", "gpt-5.6", "resp_legacy", now);
legacy.close();

const migrated = openTestStore(databasePath);
expect(migrated.getProject(projectId)).toMatchObject({
  provider: "openai",
  model: "gpt-5.6",
});
```

- [ ] **Step 2: Run persistence tests and verify failure**

Run:

```bash
npx vitest run tests/db/projects.test.ts
```

Expected: FAIL because provider fields and migration 002 do not exist.

- [ ] **Step 3: Add the ordered SQL migration**

Create `server/db/migrations/002-project-provider.sql`:

```sql
ALTER TABLE projects
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'
  CHECK (provider IN ('openai', 'anthropic'));

ALTER TABLE projects
  ADD COLUMN model TEXT NOT NULL DEFAULT 'gpt-5.6';

UPDATE projects
SET model = COALESCE(
  (
    SELECT revisions.model
    FROM revisions
    WHERE revisions.project_id = projects.id
    ORDER BY revisions.created_at, revisions.id
    LIMIT 1
  ),
  'gpt-5.6'
);

ALTER TABLE revisions
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'
  CHECK (provider IN ('openai', 'anthropic'));

ALTER TABLE revisions
  RENAME COLUMN openai_response_id TO provider_response_id;
```

- [ ] **Step 4: Update store types and writes**

In `server/db/projects.ts`:

```ts
export type ProjectProviderFields = {
  provider: AiProvider;
  model: string;
};

export type RevisionProviderFields = {
  provider: AiProvider;
  providerResponseId: string | null;
};
```

Add `ProjectProviderFields` to the existing `Project` shape and
`RevisionProviderFields` to the existing `Revision` shape; retain the existing
revision `model` property. Map `provider`, `model`, and `provider_response_id`
in row converters. Require `provider` and `model` in `createProject()`. Require
revision provider/model to equal the owning project's fixed values in
`addRevision()`; otherwise throw `PROJECT_PROVIDER_MISMATCH` with status 409.

- [ ] **Step 5: Run database and API harness tests**

Run:

```bash
npx vitest run tests/db/projects.test.ts tests/db/state.test.ts tests/api/generation.test.ts tests/api/revisions.test.ts
npm run typecheck
```

Expected: PASS; existing database behavior remains intact.

- [ ] **Step 6: Commit**

```bash
git add server/db/migrations/002-project-provider.sql server/db/projects.ts tests/db/projects.test.ts tests/api/generation-harness.ts tests/helpers/open-test-store.ts
git commit -m "feat: fix one model per project"
```

---

### Task 3: Add Anthropic Structured Generation Behind the Shared Port

**Files:**
- Create: `server/generation/anthropic-client.ts`
- Create: `server/generation/provider.ts`
- Create: `tests/generation/anthropic-client.test.ts`
- Create: `tests/generation/provider.test.ts`
- Modify: `server/generation/client.ts`
- Modify: `server/generation/service.ts`
- Modify: `app/api/projects/[id]/generate/[documentType]/route.ts`
- Modify: `app/api/projects/[id]/revisions/route.ts`
- Modify: `tests/api/generation-harness.ts`
- Modify: `tests/api/generation.test.ts`
- Modify: `tests/api/revisions.test.ts`

**Interfaces:**
- Consumes: `requireProviderConfig(provider, model)` and project provider/model.
- Produces: `createGenerationPort(provider, model): ResponsesPort`.
- Keeps: `ResponsesPort.parse()` returns `{ id, model, parsed }`; add `provider` to `GeneratedDocument`.

- [ ] **Step 1: Write failing router and Anthropic adapter tests**

In `tests/generation/provider.test.ts`:

```ts
it("routes a fixed project model to Anthropic", () => {
  expect(
    selectProviderFactory("anthropic", {
      openai: "openai-factory",
      anthropic: "anthropic-factory",
    }),
  ).toBe("anthropic-factory");
});
```

In `tests/generation/anthropic-client.test.ts`, inject a fake SDK client:

```ts
it("parses Claude structured output through the requested schema", async () => {
  const create = vi.fn().mockResolvedValue({
    id: "msg_123",
    model: "claude-opus-4-8",
    content: [{ type: "text", text: JSON.stringify(specWithWords(30)) }],
    stop_reason: "end_turn",
  });
  const port = createAnthropicResponsesPort({
    model: "claude-opus-4-8",
    create,
  });

  const result = await port.parse({
    documentType: "specification",
    prompt: "fixture",
    schema: technicalSpecificationSchema,
  });

  expect(result).toMatchObject({
    id: "msg_123",
    model: "claude-opus-4-8",
  });
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "claude-opus-4-8",
      max_tokens: 4_096,
      messages: [{ role: "user", content: "fixture" }],
    }),
  );
});
```

Add authentication, rate-limit, refusal, malformed JSON, schema failure, and transient-error cases with stable `ANTHROPIC_*` error codes.

- [ ] **Step 2: Run adapter tests and verify failure**

Run:

```bash
npx vitest run tests/generation/provider.test.ts tests/generation/anthropic-client.test.ts
```

Expected: FAIL because the adapter and router do not exist.

- [ ] **Step 3: Implement the provider selector**

Create `server/generation/provider.ts`:

```ts
import type { AiProvider } from "@/server/config";
import { requireProviderConfig } from "@/server/config";

import { createAnthropicResponsesPort } from "./anthropic-client";
import { createOpenAiResponsesPort } from "./client";

export function selectProviderFactory<T>(
  provider: AiProvider,
  factories: Record<AiProvider, T>,
) {
  return factories[provider];
}

export function createGenerationPort(provider: AiProvider, model: string) {
  const config = requireProviderConfig(provider, model);
  return provider === "openai"
    ? createOpenAiResponsesPort(config)
    : createAnthropicResponsesPort(config);
}
```

Refactor `server/generation/client.ts` so `createOpenAiResponsesPort()` accepts
`{ apiKey, model }` rather than loading global OpenAI configuration.

- [ ] **Step 4: Implement the Anthropic adapter**

Use the official SDK's structured-output helper:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

export function createAnthropicResponsesPort({
  apiKey,
  model,
  create,
}: {
  apiKey?: string;
  model: string;
  create?: Anthropic["messages"]["create"];
}): ResponsesPort {
  const client = create
    ? null
    : new Anthropic({ apiKey, maxRetries: 2 });
  const send = create ?? client!.messages.create.bind(client!.messages);

  return {
    async parse(request) {
      const response = await send({
        model,
        max_tokens: 4_096,
        messages: [{ role: "user", content: request.prompt }],
        output_config: {
          format: zodOutputFormat(
            request.schema as ZodType,
            `${request.documentType}_document`,
          ),
        },
      });

      if (response.stop_reason === "refusal") {
        throw new AppError(
          "ANTHROPIC_REFUSAL",
          "Claude declined to generate this document.",
          422,
        );
      }
      if (response.stop_reason === "max_tokens") {
        throw new AppError(
          "ANTHROPIC_OUTPUT_TRUNCATED",
          "Claude returned an incomplete document.",
          502,
          true,
        );
      }
      if (response.stop_reason !== "end_turn") {
        throw new AppError(
          "ANTHROPIC_OUTPUT_INCOMPLETE",
          "Claude returned an incomplete document.",
          502,
          true,
        );
      }

      const text = response.content
        .filter(
          (block): block is Anthropic.TextBlock => block.type === "text",
        )
        .map((block) => block.text)
        .join("");

      if (!text) {
        throw new AppError(
          "ANTHROPIC_OUTPUT_EMPTY",
          "Claude returned an empty document.",
          502,
          true,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new AppError(
          "ANTHROPIC_OUTPUT_INVALID",
          "Claude returned an invalid document.",
          502,
          true,
        );
      }

      const validated = request.schema.safeParse(parsed);
      if (!validated.success) {
        throw new AppError(
          "ANTHROPIC_OUTPUT_INVALID",
          "Claude returned an invalid document.",
          502,
          true,
        );
      }

      return {
        id: response.id,
        model: response.model,
        parsed: validated.data,
      };
    },
  };
}
```

Wrap the `send()` call and map Anthropic's typed `AuthenticationError`,
`RateLimitError`, and `APIConnectionError` to `ANTHROPIC_AUTHENTICATION`,
`ANTHROPIC_RATE_LIMIT`, and `ANTHROPIC_CONNECTION` `AppError` codes. Preserve
the output-state errors above, and map every other provider exception to
`ANTHROPIC_REQUEST_FAILED`; responses expose codes, not provider exception
messages. Do not enable adaptive thinking for this short structured document
task.

- [ ] **Step 5: Route initial generation and revisions through the project**

In both generation routes:

```ts
const port = e2eFixturesEnabled()
  ? fixtureResponsesPort
  : createGenerationPort(project.provider, project.model);
```

Pass `provider`, `model`, and `providerResponseId` into `addRevision()`. Remove
the global real-generation objects that resolve a provider before loading the
project.

- [ ] **Step 6: Run provider and API tests**

Run:

```bash
npx vitest run tests/generation/anthropic-client.test.ts tests/generation/provider.test.ts tests/api/generation.test.ts tests/api/revisions.test.ts
npm run typecheck
```

Expected: PASS for OpenAI and Anthropic paths; approved projects still reject
before either provider is called.

- [ ] **Step 7: Commit**

```bash
git add server/generation/anthropic-client.ts server/generation/provider.ts server/generation/client.ts server/generation/service.ts app/api/projects/[id]/generate/[documentType]/route.ts app/api/projects/[id]/revisions/route.ts tests/generation/anthropic-client.test.ts tests/generation/provider.test.ts tests/api/generation-harness.ts tests/api/generation.test.ts tests/api/revisions.test.ts
git commit -m "feat: generate with OpenAI or Claude"
```

---

### Task 4: Align the Generated Document Templates

**Files:**
- Modify: `server/generation/schemas.ts`
- Modify: `server/generation/prompts.ts`
- Modify: `server/generation/service.ts`
- Modify: `server/generation/word-count.ts`
- Modify: `tests/generation/helpers.ts`
- Modify: `tests/generation/prompts.test.ts`
- Modify: `tests/generation/schemas.test.ts`
- Modify: `tests/generation/service.test.ts`
- Modify: `tests/fixtures/openai-responses.ts`

**Interfaces:**
- Produces: `technicalSpecificationSchema` with the five canonical mockup sections.
- Produces: `SPEC_PROMPT_VERSION = "spec-v2"` and `NDA_PROMPT_VERSION = "nda-v2"`.
- Keeps: common rendering and validation for both providers.

- [ ] **Step 1: Write failing schema, prompt, and rendering tests**

Update `tests/generation/prompts.test.ts`:

```ts
it("uses the canonical specification order and 1000-word ceiling", () => {
  const prompt = buildSpecificationPrompt({
    idea: "A concise local idea-proof application.",
    technologyPreference: "Next.js and SQLite",
  });

  expect(prompt).toContain("Maximum 1000 words");
  expect(prompt.indexOf("Product Overview")).toBeLessThan(
    prompt.indexOf("Core Features"),
  );
  expect(prompt.indexOf("Core Features")).toBeLessThan(
    prompt.indexOf("Technical Architecture"),
  );
  expect(prompt.indexOf("Technical Architecture")).toBeLessThan(
    prompt.indexOf("API Design"),
  );
  expect(prompt.indexOf("API Design")).toBeLessThan(
    prompt.indexOf("Security Considerations"),
  );
});
```

Add a rendering assertion:

```ts
expect(toSpecificationMarkdown(validSpecification)).toMatch(
  /## 1\\. Product Overview[\\s\\S]*## 2\\. Core Features[\\s\\S]*## 3\\. Technical Architecture[\\s\\S]*## 4\\. API Design[\\s\\S]*## 5\\. Security Considerations/,
);
```

Keep NDA tests for blanks, 700 words, extra approved sections, and prohibited
legal clauses.

- [ ] **Step 2: Run generation tests and verify failure**

Run:

```bash
npx vitest run tests/generation/prompts.test.ts tests/generation/schemas.test.ts tests/generation/service.test.ts
```

Expected: FAIL on the old schema fields, old prompt version, and 1,200-word limit.

- [ ] **Step 3: Implement the canonical specification schema**

Replace the specification fields with:

```ts
export const technicalSpecificationSchema = z
  .object({
    title: z.string().min(1).max(120),
    productOverview: z.string().min(1),
    coreFeatures: z.array(z.string().min(1)).min(1).max(8),
    technicalArchitecture: z.string().min(1),
    apiDesign: z.string().min(1),
    securityConsiderations: z.array(z.string().min(1)).min(1).max(8),
  })
  .strict();
```

Render exactly the five numbered headings. Change the specification limit in
`requestFor()` to `1_000`, increment prompt versions, and explicitly list the
required section order in the prompt.

- [ ] **Step 4: Keep provider-independent safety gates**

Run all structured output through:

1. Zod schema parsing;
2. canonical Markdown rendering;
3. visible word counting;
4. one shortening retry;
5. final 1,000/700-word enforcement;
6. deterministic NDA prohibited-clause validation.

Update fixtures so OpenAI and Anthropic return identical visible structures.

- [ ] **Step 5: Run all generation tests**

Run:

```bash
npx vitest run tests/generation
npm run typecheck
```

Expected: PASS with specification output at or below 1,000 words and NDA output
at or below 700 words.

- [ ] **Step 6: Commit**

```bash
git add server/generation/schemas.ts server/generation/prompts.ts server/generation/service.ts server/generation/word-count.ts tests/generation tests/fixtures/openai-responses.ts
git commit -m "feat: follow the sample document templates"
```

---

### Task 5: Recreate the Shared Mockup Shell, Homepage, and How It Works

**Files:**
- Add: `assets/fonts/IBMPlexMono-Regular.ttf`
- Modify: `assets/fonts/OFL.txt`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/app-nav.tsx`
- Modify: `app/page.tsx`
- Create: `app/how-it-works/page.tsx`
- Create: `tests/ui/copy-contract.test.ts`

**Interfaces:**
- Produces: canonical shared navigation and `/how-it-works`.
- Consumes: no provider secrets or project data.

- [ ] **Step 1: Add failing copy-contract tests**

Create `tests/ui/copy-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

it("keeps the canonical homepage and navigation copy", () => {
  const home = read("app/page.tsx");
  const nav = read("components/app-nav.tsx");

  expect(home).toContain("Timestamp your");
  expect(home).toContain("Own the moment it happened.");
  expect(home).not.toContain("Local-first idea protection");
  expect(nav.indexOf("Proof Logs")).toBeLessThan(nav.indexOf("Verify proof"));
  expect(nav.indexOf("Verify proof")).toBeLessThan(
    nav.indexOf("How it works"),
  );
  expect(nav.indexOf("How it works")).toBeLessThan(nav.indexOf("Terms"));
  expect(nav).not.toMatch(/>Home</);
});

it("uses the approved digital fingerprint explanation", () => {
  const page = read("app/how-it-works/page.tsx");
  expect(page).toContain("digital fingerprint of each approved PDF");
  expect(page).toContain("Your PDFs stay on your machine");
  expect(page).not.toMatch(/Bitcoin|opaque commitment|blockchain/i);
});
```

- [ ] **Step 2: Run the copy tests and verify failure**

Run:

```bash
npx vitest run tests/ui/copy-contract.test.ts
```

Expected: FAIL because the current homepage/nav copy differs and the new route
does not exist.

- [ ] **Step 3: Add self-hosted IBM Plex typography**

Obtain `IBMPlexMono-Regular.ttf` from the official IBM Plex distribution.
Record its SHA-256 in `THIRD_PARTY_NOTICES.md`. Keep all three runtime font
files in `assets/fonts/` and load them in `app/layout.tsx`:

```tsx
import localFont from "next/font/local";

const plexSans = localFont({
  src: [
    {
      path: "../assets/fonts/IBMPlexSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/IBMPlexSans-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = localFont({
  src: "../assets/fonts/IBMPlexMono-Regular.ttf",
  variable: "--font-plex-mono",
  display: "swap",
});

<body className={`${plexSans.variable} ${plexMono.variable}`}>
```

Set body copy to `var(--font-plex-sans)` and code, hashes, dates, statuses, and
eyebrows to `var(--font-plex-mono)` in `app/globals.css`. Do not use a runtime
font network request.

- [ ] **Step 4: Rebuild navigation and homepage from the canonical contract**

Implement:

```tsx
<Link className="wordmark" href="/">IdeaProof</Link>
<Link href="/projects">Proof Logs</Link>
<Link href="/verify">Verify proof</Link>
<Link href="/how-it-works">How it works</Link>
<Link href="/terms">Terms</Link>
<Link className="button button-small" href="/projects/new">
  Protect an idea
</Link>
```

Use the exact hero, two actions, five workflow cards, and three trust notes from
the approved specification. Match the mockup's `oklch(0.55 0.15 245)` primary
accent and 60-pixel navigation height. Keep the existing skip link, semantic
headings, keyboard focus, and reduced-motion rule.

- [ ] **Step 5: Build the accessible How It Works flow**

Create a semantic ordered list with five steps:

```tsx
<ol className="how-flow">
  <li>
    <h2>Describe</h2>
    <p>
      Enter your idea, NDA purpose, and optional details. Your project is
      stored locally.
    </p>
  </li>
  <li>
    <h2>Choose and generate</h2>
    <p>
      Choose one available model for the project. IdeaProof sends the required
      content to that provider and generates a technical specification and
      sample NDA.
    </p>
  </li>
  <li>
    <h2>Review and revise</h2>
    <p>Read both documents, request changes, and inspect saved versions.</p>
  </li>
  <li>
    <h2>Approve exact PDFs</h2>
    <p>Choose exact revisions. IdeaProof creates final PDFs and locks approval.</p>
  </li>
  <li>
    <h2>Timestamp and verify</h2>
    <p>
      IdeaProof creates a digital fingerprint of each approved PDF and
      timestamps it with OpenTimestamps. Your PDFs stay on your machine, and
      anyone with the PDF and its proof can later verify that the document has
      not changed.
    </p>
  </li>
</ol>
```

Use CSS connectors and numbered markers; do not generate or ship a raster
diagram.

- [ ] **Step 6: Run copy, lint, and type checks**

Run:

```bash
npx vitest run tests/ui/copy-contract.test.ts
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add assets/fonts THIRD_PARTY_NOTICES.md app/layout.tsx app/globals.css components/app-nav.tsx app/page.tsx app/how-it-works/page.tsx tests/ui/copy-contract.test.ts
git commit -m "feat: recreate the sample home and flow"
```

---

### Task 6: Add the New Project Model Picker and Canonical Intake

**Files:**
- Modify: `app/projects/new/page.tsx`
- Modify: `components/project-form.tsx`
- Modify: `app/api/projects/route.ts`
- Modify: `tests/api/projects.test.ts`
- Modify: `tests/ui/copy-contract.test.ts`

**Interfaces:**
- Consumes: `listConfiguredProviders()` and project-store provider/model input.
- Produces: validated project creation with one fixed provider/model.

- [ ] **Step 1: Write failing API tests for all availability combinations**

Add to `tests/api/projects.test.ts`:

```ts
it("accepts only a configured provider and model", async () => {
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.OPENAI_MODEL = "gpt-5.6";
  delete process.env.ANTHROPIC_API_KEY;

  const rejected = await POST(
    jsonRequest({
      ...validProjectInput,
      provider: "anthropic",
      model: "claude-opus-4-8",
    }),
  );
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toMatchObject({
    code: "PROJECT_MODEL_UNAVAILABLE",
  });

  const accepted = await POST(
    jsonRequest({
      ...validProjectInput,
      provider: "openai",
      model: "gpt-5.6",
    }),
  );
  expect(accepted.status).toBe(201);
  expect(await accepted.json()).toMatchObject({
    provider: "openai",
    model: "gpt-5.6",
  });
});
```

Add cases for Anthropic-only, both with OpenAI default in the form, and neither
configured.

- [ ] **Step 2: Run API tests and verify failure**

Run:

```bash
npx vitest run tests/api/projects.test.ts
```

Expected: FAIL because project input does not accept or validate provider/model.

- [ ] **Step 3: Validate the server-owned provider catalog**

Extend `projectInputSchema` with:

```ts
provider: z.enum(["openai", "anthropic"]),
model: z.string().trim().min(1).max(120),
```

After parsing, require an exact match from `listConfiguredProviders()`. Return
`PROJECT_MODEL_UNAVAILABLE` without revealing configuration values.

- [ ] **Step 4: Implement the canonical New Project page**

Load provider summaries in the server component and pass them to:

```ts
<ProjectForm providers={listConfiguredProviders()} />
```

Use the approved heading, four-field order, blue local-storage banner, and
exact submit label:

```text
Generate technical specification and sample NDA
```

Render provider choices as a radio group when there are two. When there is one,
show the single model in a noninteractive summary and submit hidden
provider/model fields. When there are none, disable submit and link to `/setup`.

- [ ] **Step 5: Run API, copy, and accessibility checks**

Run:

```bash
npx vitest run tests/api/projects.test.ts tests/ui/copy-contract.test.ts
npm run lint
npm run typecheck
```

Expected: PASS; the serialized page contains model labels but no API keys.

- [ ] **Step 6: Commit**

```bash
git add app/projects/new/page.tsx components/project-form.tsx app/api/projects/route.ts tests/api/projects.test.ts tests/ui/copy-contract.test.ts
git commit -m "feat: choose one model per idea project"
```

---

### Task 7: Align Logs, Generation, Review, and History with the Mockup

**Files:**
- Modify: `app/projects/page.tsx`
- Modify: `components/project-list.tsx`
- Modify: `components/status-badge.tsx`
- Modify: `app/projects/[id]/generating/page.tsx`
- Modify: `components/generation-progress.tsx`
- Modify: `app/projects/[id]/review/page.tsx`
- Modify: `components/review-workspace.tsx`
- Modify: `app/projects/[id]/history/page.tsx`
- Modify: `components/document-preview.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/screenshots.spec.ts`

**Interfaces:**
- Consumes: persisted project provider/model and existing revisions.
- Produces: mockup-faithful production screens with no demo controls.

- [ ] **Step 1: Extend screenshot coverage before visual changes**

Update `tests/e2e/screenshots.spec.ts` to capture:

```ts
await page.screenshot({ path: "/tmp/ideaproof-logs.png", fullPage: true });
await page.screenshot({ path: "/tmp/ideaproof-generating.png", fullPage: true });
await page.screenshot({ path: "docs/images/ideaproof-review.png", fullPage: true });
await page.screenshot({ path: "/tmp/ideaproof-history.png", fullPage: true });
```

Add assertions for canonical headings, tabs, version selector, revision feedback,
and the absence of demo data.

- [ ] **Step 2: Run the screenshot journey and record the baseline failure**

Run:

```bash
npx playwright test tests/e2e/screenshots.spec.ts
```

Expected: FAIL on canonical copy assertions before the retrofit.

- [ ] **Step 3: Align Proof Logs**

Use mockup copy:

```text
Proof Logs
Your ideas, generated documents, and proof status.
Protect a new idea
```

Keep real server-side search/status parameters. Use the mockup's row hierarchy,
date/status alignment, and empty state. Include draft, pending, confirmed, and
failed filters; do not add example records.

```tsx
<header className="page-heading">
  <div>
    <h1>Proof Logs</h1>
    <p>Your ideas, generated documents, and proof status.</p>
  </div>
  <Link className="button" href="/projects/new">Protect a new idea</Link>
</header>
```

- [ ] **Step 4: Align real generation progress**

Use the mockup heading `Preparing your documents` and real steps:

1. Organizing product requirements
2. Generating technical specification
3. Generating sample NDA
4. Saving document revisions

Keep retry behavior and `aria-live`. Do not fake timed steps or completion.
Display the project's fixed provider/model below the heading.

```tsx
<h1>Preparing your documents</h1>
<p className="model-metadata">
  {project.provider === "openai" ? "OpenAI" : "Claude"} · {project.model}
</p>
<ol aria-live="polite">
  <li>Organizing product requirements</li>
  <li>Generating technical specification</li>
  <li>Generating sample NDA</li>
  <li>Saving document revisions</li>
</ol>
```

- [ ] **Step 5: Align review and history**

Use the mockup's:

- `Review your documents` heading;
- Technical specification and Mutual NDA tabs;
- document-first two-column layout;
- request-changes panel;
- compact revision summary;
- `Revision history` route and chronological version entries.

Keep the tested revision selector semantics and query-bound approval IDs. Show
the fixed provider/model as metadata, never as a mutable control.

```tsx
<header className="review-heading">
  <div>
    <h1>Review your documents</h1>
    <p>{project.provider === "openai" ? "OpenAI" : "Claude"} · {project.model}</p>
  </div>
  <Link href={`/projects/${project.id}/history`}>Revision history</Link>
</header>

<div role="tablist" aria-label="Generated documents">
  <button role="tab">Technical specification</button>
  <button role="tab">Mutual NDA</button>
</div>
```

- [ ] **Step 6: Run the focused browser journey**

Run:

```bash
npx playwright test tests/e2e/screenshots.spec.ts
npx vitest run tests/api/generation.test.ts tests/api/revisions.test.ts tests/db/state.test.ts
```

Expected: PASS; screenshots contain real deterministic fixture content and no
demo toggles.

- [ ] **Step 7: Commit**

```bash
git add app/projects components/project-list.tsx components/status-badge.tsx components/generation-progress.tsx components/review-workspace.tsx components/document-preview.tsx app/globals.css tests/e2e/screenshots.spec.ts docs/images/ideaproof-review.png
git commit -m "feat: match the sample project workflow"
```

---

### Task 8: Add Manifest V2 and Align Approval, Proof, Verify, and Terms

**Files:**
- Modify: `server/documents/package.ts`
- Modify: `app/api/projects/[id]/approve/route.ts`
- Modify: `app/projects/[id]/approve/page.tsx`
- Modify: `components/approval-button.tsx`
- Modify: `app/projects/[id]/proof/page.tsx`
- Modify: `components/proof-status.tsx`
- Modify: `app/verify/page.tsx`
- Modify: `components/verify-form.tsx`
- Modify: `app/terms/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/documents/package.test.ts`
- Modify: `tests/api/approval.test.ts`
- Modify: `tests/api/verify.test.ts`
- Modify: `tests/e2e/ideaproof.spec.ts`

**Interfaces:**
- Consumes: revision provider/model and existing immutable approval workflow.
- Produces: `ManifestV2` with `schemaVersion: 2` and document `provider`.
- Keeps: `ManifestV1` type for reading/documenting existing packages.

- [ ] **Step 1: Write failing Manifest V2 tests**

Update `tests/documents/package.test.ts`:

```ts
const manifest: ManifestV2 = {
  schemaVersion: 2,
  projectId: "00000000-0000-4000-8000-000000000001",
  approvalId: "00000000-0000-4000-8000-000000000002",
  approvedAt: "2026-07-25T00:00:00.000Z",
  documents: [
    {
      type: "specification",
      revisionId: "00000000-0000-4000-8000-000000000003",
      markdownFile: "technical-specification.md",
      pdfFile: "technical-specification.pdf",
      proofFile: "technical-specification.pdf.ots",
      sha256: "a".repeat(64),
      wordCount: 800,
      promptTemplateVersion: "spec-v2",
      provider: "anthropic",
      model: "claude-opus-4-8",
    },
  ],
};

expect(JSON.parse(strFromU8(zip["manifest.json"]))).toMatchObject({
  schemaVersion: 2,
  documents: [
    { provider: "anthropic", model: "claude-opus-4-8" },
  ],
});
```

- [ ] **Step 2: Run package and approval tests and verify failure**

Run:

```bash
npx vitest run tests/documents/package.test.ts tests/api/approval.test.ts
```

Expected: FAIL because Manifest V2 and provider fields do not exist.

- [ ] **Step 3: Implement Manifest V2 without breaking V1**

In `server/documents/package.ts`:

```ts
export type ManifestV2 = Omit<ManifestV1, "schemaVersion" | "documents"> & {
  schemaVersion: 2;
  documents: Array<
    ManifestV1["documents"][number] & {
      provider: AiProvider;
    }
  >;
};

export type ProofManifest = ManifestV1 | ManifestV2;
```

Allow `buildProofPackage()` to accept `ProofManifest`. New approvals always
write V2 and include each selected revision's provider/model.

- [ ] **Step 4: Align approval and proof status**

Keep the dedicated approval route, but visually match the sample dialog:

- `Approve these documents?`
- exact selected specification and sample NDA version;
- immutability explanation;
- OpenTimestamps confirmation can take time;
- Keep reviewing;
- Approve and create proof.

On Proof Status, use real pending/confirmed/failed states. Replace technical
timestamp language with `digital fingerprint of each approved PDF`. Keep
download, retry, check confirmation, and independent verify actions.

```tsx
<h1>Approve these documents?</h1>
<p>
  Approval locks the selected technical specification and sample NDA versions.
  IdeaProof then creates a digital fingerprint of each approved PDF and starts
  its OpenTimestamps proof. Confirmation can take time.
</p>
<button type="button">Keep reviewing</button>
<button type="submit">Approve and create proof</button>
```

- [ ] **Step 5: Align Verify and Terms**

Keep the required PDF + proof-file upload controls and safe size/type handling.
Use the mockup's state hierarchy for confirmed, pending, mismatch, and invalid.

Terms must state:

- AI-generated documents can contain errors;
- the sample NDA is not legal advice;
- generation sends required content to the selected provider;
- local files are not application-encrypted;
- timestamps verify exact PDFs but do not prove ownership or legal validity.

```tsx
<section>
  <h1>Verify proof</h1>
  <label>
    PDF file
    <input name="pdf" type="file" accept="application/pdf" required />
  </label>
  <label>
    OpenTimestamps proof
    <input name="proof" type="file" accept=".ots,application/octet-stream" required />
  </label>
  <button type="submit">Verify proof</button>
</section>
```

- [ ] **Step 6: Verify complete immutable approval behavior**

Run:

```bash
npx vitest run tests/documents/package.test.ts tests/api/approval.test.ts tests/api/verify.test.ts tests/db/state.test.ts
npx playwright test tests/e2e/ideaproof.spec.ts
```

Expected: PASS; downloaded manifest is V2, contains the selected provider/model,
and contains no key or internal path.

- [ ] **Step 7: Commit**

```bash
git add server/documents/package.ts app/api/projects/[id]/approve/route.ts app/projects/[id]/approve/page.tsx components/approval-button.tsx app/projects/[id]/proof/page.tsx components/proof-status.tsx app/verify/page.tsx components/verify-form.tsx app/terms/page.tsx app/globals.css tests/documents/package.test.ts tests/api/approval.test.ts tests/api/verify.test.ts tests/e2e/ideaproof.spec.ts
git commit -m "feat: identify providers in immutable proofs"
```

---

### Task 9: Documentation, Full Visual Fidelity, and Release Verification

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docs/images/ideaproof-home.png`
- Modify: `docs/images/ideaproof-review.png`
- Modify: `tests/e2e/ideaproof.spec.ts`
- Modify: `tests/e2e/screenshots.spec.ts`

**Interfaces:**
- Consumes: every production surface and both provider fixtures.
- Produces: release-ready documentation, screenshots, and verified local setup.

- [ ] **Step 1: Extend E2E fixtures to expose both providers safely**

Make deterministic fixtures select output by the project's provider while
returning distinct safe response IDs:

```ts
{
  provider: "openai",
  model: "fixture-openai",
  id: "resp_fixture_1",
}

{
  provider: "anthropic",
  model: "fixture-claude",
  id: "msg_fixture_1",
}
```

Run the full story once with OpenAI and once with Anthropic. Assert that one
project never changes provider during revision.

- [ ] **Step 2: Update user and contributor documentation**

README must include:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8
```

Explain the four availability combinations, one model per project, provider
content transmission, local storage, sample-NDA disclaimer, 1,000/700-word
limits, and the plain digital-fingerprint explanation.

Update Docker Compose so either or both provider variables pass through from
`.env`; keep `127.0.0.1:3000` binding and direct setup as primary.

- [ ] **Step 3: Regenerate public screenshots from deterministic fixtures**

Run:

```bash
npx playwright test tests/e2e/screenshots.spec.ts
```

Expected:

- `docs/images/ideaproof-home.png` matches the canonical homepage;
- `docs/images/ideaproof-review.png` matches the canonical review layout;
- neither image contains secrets or personal data.

- [ ] **Step 4: Perform the canonical visual comparison**

Inspect the mockup and implementation side by side at:

- desktop 1440 × 1000;
- mobile 375 × 812;
- 200% browser zoom;
- reduced-motion mode.

Review home, logs, intake, generation, review, history, approval, proof, verify,
How It Works, Terms, Setup, mobile navigation, empty states, and failure states.
Fix only concrete fidelity, accessibility, clipping, or truthfulness defects.

- [ ] **Step 5: Run the complete release gate**

Run:

```bash
npm run setup
npm run verify
npm run test:e2e
OPENAI_API_KEY=smoke-fixture-key IDEAPROOF_DATA_DIR=/tmp/ideaproof-provider-smoke IDEAPROOF_SMOKE_PORT=3101 npm run smoke
npm audit --omit=dev
git diff --check
```

Expected:

- setup reports the project-local OpenTimestamps client;
- lint, typecheck, unit/integration tests, and build pass;
- both Chromium provider journeys pass;
- production smoke returns HTTP 200 for home and setup;
- npm reports zero known production vulnerabilities;
- no whitespace errors.

- [ ] **Step 6: Run secret, data, and runtime-boundary audits**

Run:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!.next/**' --glob '!.git/**' --glob '!.venv/**' '(sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY\\s*=\\s*[^[:space:]#]+|ANTHROPIC_API_KEY\\s*=\\s*[^[:space:]#]+)' .
git ls-files | rg '(^|/)(data|\\.env|\\.venv|test-results|playwright-report)(/|$)'
rg -n 'support\\.js|animations-v2|tweaks-panel|x-dc|DCLogic|omelette' app components server scripts tests package.json README.md
```

Expected: only obvious short test fixtures match; no tracked private runtime
data; no dependency on the mockup runtime.

- [ ] **Step 7: Request final code review**

Use `superpowers:requesting-code-review`. Resolve every correctness, security,
privacy, accessibility, and release-blocking finding, then rerun the smallest
affected checks followed by `npm run verify` and `npm run test:e2e`.

- [ ] **Step 8: Commit**

```bash
git add README.md CONTRIBUTING.md THIRD_PARTY_NOTICES.md Dockerfile docker-compose.yml docs/images tests/e2e
git commit -m "docs: explain providers and PDF fingerprints"
```

- [ ] **Step 9: Confirm the branch is ready for handoff**

Run:

```bash
git status --short
git log -10 --oneline
```

Expected: clean worktree with nine focused implementation commits after this
plan commit. Do not merge or push without explicit user instruction.
