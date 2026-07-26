# IdeaProof Local Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first IdeaProof web application that generates concise technical specifications and NDA templates with a user's OpenAI API key, preserves revisions, and creates and verifies OpenTimestamps proofs for approved PDFs.

**Architecture:** One Next.js App Router process serves the browser UI and server routes on `127.0.0.1:3000`. Server-only modules use Node's built-in SQLite API, the OpenAI Responses API, deterministic PDF rendering, and a project-local Python `ots` executable; Docker Compose is optional and never required by the application or test suite.

**Tech Stack:** Node.js 24.14+, Next.js 16.2.11, React 19.2.8, strict TypeScript, `node:sqlite`, OpenAI SDK 6.49.0, Zod 4.4.3, `pdf-lib` 1.17.1, `@pdf-lib/fontkit` 1.1.1, `fflate` 0.8.3, `react-markdown` 10.1.0, Vitest 4.1.10, Playwright 1.62.0, Python 3.9+, and `opentimestamps-client==0.7.2`.

## Global Constraints

- The primary user path is clone, configure `.env`, `npm install`, `npm run setup`, `npm run build`, and `npm start`; Docker is optional.
- The production server binds to `127.0.0.1:3000` by default.
- `OPENAI_API_KEY` stays server-side and never enters browser bundles, SQLite, logs, errors, manifests, or downloads.
- `OPENAI_MODEL` defaults to `gpt-5.6` and remains configurable.
- SQLite and artifacts live under `IDEAPROOF_DATA_DIR`, defaulting to `./data`.
- The technical specification is at most 1,200 words.
- The mutual NDA template is at most 700 words and has no governing-jurisdiction clause.
- NDA purpose is required; Party A, Party B, Effective Date, and Confidentiality Period remain labeled blanks unless supplied in the optional free-form NDA details.
- Approved revisions and their generated artifacts are immutable.
- Canonical source is UTF-8 Markdown; OpenTimestamps proofs cover the exact approved PDFs.
- Idea content is sent only to OpenAI for generation or revision; OpenTimestamps receives opaque commitments, not document content.
- There is no account system, hosted storage, telemetry, background worker, application-level encryption, document signing, or legal-advice claim in version 1.
- Raw HTML and remote embedded content are disabled in generated Markdown.
- The app must work and pass its production smoke test without Docker.
- The copied Omelette runtime files are reference-only, must never be imported or copied, and the entire `ideaproof_design/` directory is removed after visual verification and README screenshots are complete.

---

## Planned File Structure

```text
.
├── app/
│   ├── api/
│   │   ├── projects/route.ts
│   │   ├── projects/[id]/generate/[documentType]/route.ts
│   │   ├── projects/[id]/revisions/route.ts
│   │   ├── projects/[id]/approve/route.ts
│   │   ├── projects/[id]/proof/check/route.ts
│   │   ├── projects/[id]/package/route.ts
│   │   ├── setup/route.ts
│   │   └── verify/route.ts
│   ├── projects/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/
│   │       ├── generating/page.tsx
│   │       ├── review/page.tsx
│   │       ├── history/page.tsx
│   │       └── proof/page.tsx
│   ├── setup/page.tsx
│   ├── terms/page.tsx
│   ├── verify/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── assets/fonts/
│   ├── IBMPlexSans-Regular.ttf
│   ├── IBMPlexSans-SemiBold.ttf
│   └── OFL.txt
├── components/
│   ├── app-nav.tsx
│   ├── document-preview.tsx
│   ├── generation-progress.tsx
│   ├── project-form.tsx
│   ├── project-list.tsx
│   ├── proof-status.tsx
│   ├── review-workspace.tsx
│   ├── status-badge.tsx
│   └── verify-form.tsx
├── docs/images/
│   ├── ideaproof-home.png
│   └── ideaproof-review.png
├── scripts/
│   ├── setup-ots.mjs
│   └── smoke-start.mjs
├── server/
│   ├── config.ts
│   ├── errors.ts
│   ├── db/
│   │   ├── connection.ts
│   │   ├── migrate.ts
│   │   ├── migrations/001-initial.sql
│   │   └── projects.ts
│   ├── generation/
│   │   ├── client.ts
│   │   ├── prompts.ts
│   │   ├── schemas.ts
│   │   ├── service.ts
│   │   └── word-count.ts
│   ├── documents/
│   │   ├── markdown.ts
│   │   ├── package.ts
│   │   └── pdf.ts
│   └── proof/
│       ├── ots.ts
│       └── parse.ts
├── tests/
│   ├── api/
│   ├── db/
│   ├── documents/
│   ├── e2e/ideaproof.spec.ts
│   ├── fixtures/fake-ots.mjs
│   ├── generation/
│   ├── helpers/
│   │   ├── http.ts
│   │   └── open-test-store.ts
│   ├── proof/
│   ├── setup.ts
│   └── smoke/production.test.ts
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── Dockerfile
├── LICENSE
├── README.md
├── THIRD_PARTY_NOTICES.md
├── docker-compose.yml
├── eslint.config.mjs
├── next.config.ts
├── package-lock.json
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## Task 1: Project Foundation and Direct Local Setup

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `server/config.ts`
- Create: `server/errors.ts`
- Create: `scripts/setup-ots.mjs`
- Create: `scripts/smoke-start.mjs`
- Create: `.env.example`
- Modify: `.gitignore`
- Test: `tests/setup.ts`
- Test: `tests/config.test.ts`
- Test: `tests/smoke/production.test.ts`

**Interfaces:**
- Produces: `loadConfig(): AppConfig`
- Produces: `checkSetup(): Promise<SetupCheck>`
- Produces: `AppError` with stable `code`, safe `message`, `retryable`, and HTTP `status`
- Produces: package scripts `setup`, `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, and `verify`

- [ ] **Step 1: Write failing configuration tests**

```ts
// tests/config.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "@/server/config";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

describe("loadConfig", () => {
  it("keeps secrets server-side and applies safe defaults", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.OPENAI_MODEL;
    delete process.env.IDEAPROOF_DATA_DIR;

    expect(loadConfig()).toMatchObject({
      openAiApiKey: "sk-test",
      openAiModel: "gpt-5.6",
      host: "127.0.0.1",
      port: 3000,
    });
  });

  it("rejects a missing API key with a stable code", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => loadConfig()).toThrowError(
      expect.objectContaining({ code: "SETUP_OPENAI_KEY_MISSING" }),
    );
  });
});
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run: `npm test -- tests/config.test.ts`

Expected: FAIL because `package.json` and `server/config.ts` do not exist.

- [ ] **Step 3: Scaffold the smallest Next.js project and pin dependencies**

Create `package.json` with exact runtime scripts and versions:

```json
{
  "name": "ideaproof",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "engines": { "node": ">=24.14.0", "npm": ">=10" },
  "scripts": {
    "setup": "node scripts/setup-ots.mjs",
    "dev": "next dev --hostname 127.0.0.1",
    "build": "next build",
    "start": "next start --hostname 127.0.0.1 --port 3000",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "verify": "npm run lint && npm run typecheck && npm test && npm run build",
    "smoke": "node scripts/smoke-start.mjs"
  },
  "dependencies": {
    "@pdf-lib/fontkit": "1.1.1",
    "fflate": "0.8.3",
    "next": "16.2.11",
    "openai": "6.49.0",
    "pdf-lib": "1.17.1",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-markdown": "10.1.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@playwright/test": "1.62.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "16.2.11",
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
```

Run: `npm install`

Expected: `package-lock.json` is created with no install error.

- [ ] **Step 4: Implement strict configuration and safe application errors**

```ts
// server/errors.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// server/config.ts
import "server-only";
import path from "node:path";
import { AppError } from "./errors";

export type AppConfig = {
  openAiApiKey: string;
  openAiModel: string;
  dataDir: string;
  host: "127.0.0.1";
  port: 3000;
};

export function loadConfig(): AppConfig {
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiApiKey) {
    throw new AppError(
      "SETUP_OPENAI_KEY_MISSING",
      "Add OPENAI_API_KEY to your local .env file.",
      503,
    );
  }
  return {
    openAiApiKey,
    openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.6",
    dataDir: path.resolve(process.env.IDEAPROOF_DATA_DIR || "./data"),
    host: "127.0.0.1",
    port: 3000,
  };
}
```

- [ ] **Step 5: Add the direct-install OpenTimestamps setup script**

```js
// scripts/setup-ots.mjs
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const candidates = process.platform === "win32"
  ? [["py", ["-3"]], ["python", []]]
  : [["python3", []], ["python", []]];
const selected = candidates.find(([cmd, args]) =>
  spawnSync(cmd, [...args, "--version"], { stdio: "ignore" }).status === 0
);
if (!selected) {
  process.stderr.write("Python 3.9+ is required. Install Python, then rerun npm run setup.\n");
  process.exit(1);
}
const [python, prefix] = selected;
const venv = join(process.cwd(), ".venv");
if (!existsSync(venv)) {
  const created = spawnSync(python, [...prefix, "-m", "venv", venv], { stdio: "inherit" });
  if (created.status !== 0) process.exit(created.status ?? 1);
}
const venvPython = process.platform === "win32"
  ? join(venv, "Scripts", "python.exe")
  : join(venv, "bin", "python");
const installed = spawnSync(
  venvPython,
  ["-m", "pip", "install", "opentimestamps-client==0.7.2"],
  { stdio: "inherit" },
);
process.exit(installed.status ?? 1);
```

- [ ] **Step 6: Add the base app, design tokens, TypeScript, lint, and test configuration**

Create a server-root layout and a minimal home page using semantic elements.
Define the design colors and responsive primitives in `app/globals.css`:

```css
:root {
  color-scheme: dark;
  --bg: oklch(0.11 0.008 240);
  --surface: oklch(0.17 0.01 240);
  --border: oklch(0.25 0.01 240);
  --text: oklch(0.93 0.01 245);
  --muted: oklch(0.60 0.02 245);
  --accent: oklch(0.57 0.15 245);
  --success: oklch(0.73 0.16 155);
  --warning: oklch(0.78 0.14 60);
  --danger: oklch(0.70 0.16 25);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: Arial, sans-serif; }
button, input, textarea { font: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 7: Add environment templates and ignores**

```dotenv
# .env.example
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
IDEAPROOF_DATA_DIR=./data
```

Ensure `.gitignore` contains:

```gitignore
.DS_Store
.env
.next/
.venv/
data/
node_modules/
playwright-report/
test-results/
```

- [ ] **Step 8: Make the configuration test pass**

Run: `npm test -- tests/config.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 9: Add and run the production-start smoke test**

`scripts/smoke-start.mjs` must spawn `npm start`, wait for
`http://127.0.0.1:3000`, assert HTTP 200, then terminate only the child process.

Run: `npm run build && npm run smoke`

Expected: build exits 0 and the smoke script prints `IdeaProof responded with 200`.

- [ ] **Step 10: Commit the foundation**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts playwright.config.ts app server/config.ts server/errors.ts scripts .env.example .gitignore tests
git commit -m "chore: scaffold local IdeaProof app"
```

## Task 2: SQLite Project Store and Revision State

**Files:**
- Create: `server/db/migrations/001-initial.sql`
- Create: `server/db/connection.ts`
- Create: `server/db/migrate.ts`
- Create: `server/db/projects.ts`
- Create: `tests/helpers/open-test-store.ts`
- Test: `tests/db/projects.test.ts`
- Test: `tests/db/state.test.ts`

**Interfaces:**
- Produces: `Project`, `Revision`, `Approval`, and `ProofArtifact` types
- Produces: `createProject(input): Project`
- Produces: `listProjects(query): ProjectSummary[]`
- Produces: `getProject(id): ProjectDetail`
- Produces: `addRevision(input): Revision`
- Produces: `selectRevision(projectId, documentType, revisionId): void`
- Produces: `transitionProject(id, from, to): void`
- Produces: `createApproval(input): Approval`

- [ ] **Step 1: Write failing repository and state-transition tests**

```ts
// tests/db/projects.test.ts
import { expect, it } from "vitest";
import { openTestStore } from "../helpers/open-test-store";

it("preserves every document revision", () => {
  const store = openTestStore();
  const project = store.createProject({
    idea: "A local proof tool",
    technologyPreference: "TypeScript",
    ndaPurpose: "Evaluate a possible collaboration",
    ndaDetails: "",
  });
  const addSpec = (content: string, feedback: string | null) =>
    store.addRevision({
      projectId: project.id,
      documentType: "specification",
      content,
      wordCount: 2,
      feedback,
      promptTemplateVersion: "spec-v1",
      model: "gpt-5.6",
      openaiResponseId: "resp_test",
    });
  addSpec("# Version one", null);
  addSpec("# Version two", "Shorter");

  expect(store.getRevisions(project.id, "specification").map((r) => r.version)).toEqual([1, 2]);
});

// tests/db/state.test.ts
it("rejects an invalid draft-to-confirmed transition", () => {
  const store = openTestStore();
  const project = store.createProject({
    idea: "A local proof tool for concise idea documents",
    technologyPreference: "TypeScript",
    ndaPurpose: "Discuss a possible collaboration",
    ndaDetails: "",
  });
  expect(() => store.transitionProject(project.id, "draft", "confirmed"))
    .toThrowError(expect.objectContaining({ code: "PROJECT_STATE_INVALID" }));
});
```

- [ ] **Step 2: Run the database tests and verify they fail**

Run: `npm test -- tests/db`

Expected: FAIL because the store and migrations do not exist.

- [ ] **Step 3: Create the schema migration**

`001-initial.sql` creates `projects`, `revisions`, `approvals`, and
`proof_artifacts`, foreign keys, unique revision versions, unique approval per
project, and indexes for status, timestamps, and project revision lookup.

Use this state check in SQL-backed code:

```ts
export const allowedTransitions = {
  draft: ["generating"],
  generating: ["review", "failed"],
  review: ["generating", "pending", "failed"],
  pending: ["confirmed", "failed"],
  confirmed: [],
  failed: ["generating", "pending"],
} as const;
```

Add a test helper that creates an isolated temporary database and removes it
after each test:

```ts
// tests/helpers/open-test-store.ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectStore } from "@/server/db/projects";

export function openTestStore() {
  const dir = mkdtempSync(join(tmpdir(), "ideaproof-test-"));
  const store = createProjectStore(join(dir, "test.sqlite"));
  return Object.assign(store, {
    closeAndRemove() {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  });
}
```

- [ ] **Step 4: Implement one shared SQLite connection and migrations**

```ts
// server/db/connection.ts
import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadConfig } from "@/server/config";
import { migrate } from "./migrate";

let database: DatabaseSync | undefined;
export function getDatabase(): DatabaseSync {
  if (database) return database;
  const { dataDir } = loadConfig();
  mkdirSync(dataDir, { recursive: true });
  database = new DatabaseSync(join(dataDir, "ideaproof.sqlite"));
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  migrate(database);
  return database;
}
```

`migrate()` reads ordered checked-in SQL files, executes unapplied migrations
inside a transaction, and advances `PRAGMA user_version`.

- [ ] **Step 5: Implement parameterized project and revision methods**

Use prepared statements for every value:

```ts
const insertProject = db.prepare(`
  INSERT INTO projects
    (id, title, idea, technology_preference, nda_purpose, nda_details, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
`);
insertProject.run(id, title, input.idea, input.technologyPreference, input.ndaPurpose, input.ndaDetails, now, now);
```

Never interpolate user values into SQL. Derive the initial title from the first
80 characters of normalized idea text and allow later edits only before
approval.

- [ ] **Step 6: Implement compare-and-set state transitions**

```ts
const changed = db.prepare(`
  UPDATE projects SET status = ?, updated_at = ?
  WHERE id = ? AND status = ?
`).run(to, now, id, from);
if (changed.changes !== 1) {
  throw new AppError("PROJECT_STATE_INVALID", `Project is not in ${from} state.`, 409);
}
```

Approval creation verifies both selected revisions belong to the same project
and writes approval plus initial proof rows in one transaction.

- [ ] **Step 7: Run repository tests**

Run: `npm test -- tests/db`

Expected: PASS; invalid transitions, immutable approvals, revision numbering,
and cascade restrictions are covered.

- [ ] **Step 8: Commit the project store**

```bash
git add server/db tests/db
git commit -m "feat: add local project and revision store"
```

## Task 3: OpenAI Structured Document Generation

**Files:**
- Create: `server/generation/schemas.ts`
- Create: `server/generation/prompts.ts`
- Create: `server/generation/word-count.ts`
- Create: `server/generation/client.ts`
- Create: `server/generation/service.ts`
- Create: `tests/generation/helpers.ts`
- Test: `tests/generation/schemas.test.ts`
- Test: `tests/generation/prompts.test.ts`
- Test: `tests/generation/service.test.ts`

**Interfaces:**
- Produces: `TechnicalSpecificationOutput`
- Produces: `MutualNdaOutput`
- Produces: `generateDocument(input): Promise<GeneratedDocument>`
- Produces: `reviseDocument(input): Promise<GeneratedDocument>`
- Produces: `countWords(markdown): number`
- Consumes: `loadConfig()` and revision records from Task 2

- [ ] **Step 1: Write failing schema, prompt, and length tests**

```ts
it("leaves missing NDA facts as blanks and excludes jurisdiction", () => {
  const prompt = buildNdaPrompt({
    idea: "A local proof app",
    ndaPurpose: "Discuss a possible product collaboration",
    ndaDetails: "",
  });
  expect(prompt).toContain("Party A: ______________________");
  expect(prompt).not.toMatch(/governing law|jurisdiction/i);
});

it("retries an over-limit document once", async () => {
  const api = fakeResponses([
    specWithWords(1201),
    specWithWords(900),
  ]);
  const result = await generateDocument(validSpecInput, api);
  expect(result.wordCount).toBeLessThanOrEqual(1_200);
  expect(api.calls).toHaveLength(2);
});

it("fails after the single shortening retry", async () => {
  const api = fakeResponses([specWithWords(1201), specWithWords(1201)]);
  await expect(generateDocument(validSpecInput, api)).rejects.toMatchObject({
    code: "OPENAI_OUTPUT_TOO_LONG",
  });
});
```

Define the referenced test data and fake response port in
`tests/generation/helpers.ts`:

```ts
import type { TechnicalSpecificationOutput } from "@/server/generation/schemas";

export const validSpecInput = {
  documentType: "specification" as const,
  idea: "A local web app that creates concise idea documents and timestamps approved PDFs.",
  technologyPreference: "Next.js and SQLite",
  ndaPurpose: "Discuss a possible product collaboration",
  ndaDetails: "",
};

export function specWithWords(count: number): TechnicalSpecificationOutput {
  const words = Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
  return {
    title: "IdeaProof",
    ideaSummary: words,
    problemAndUser: "Founders need concise records.",
    goals: ["Generate concise documents"],
    nonGoals: ["Prove legal ownership"],
    coreFlow: ["Describe", "Review", "Approve"],
    technicalApproach: "Run locally.",
    boundaries: ["OpenAI receives generation input"],
    risksAndDecisions: ["Generated content needs review"],
    nextSteps: ["Validate the idea"],
  };
}

export function fakeResponses(outputs: TechnicalSpecificationOutput[]) {
  const calls: unknown[] = [];
  return {
    calls,
    async parse(request: unknown) {
      calls.push(request);
      const parsed = outputs.shift();
      if (!parsed) throw new Error("No fake response remaining");
      return { id: `resp_${calls.length}`, model: "gpt-5.6", parsed };
    },
  };
}
```

- [ ] **Step 2: Run generation tests and verify they fail**

Run: `npm test -- tests/generation`

Expected: FAIL because generation modules do not exist.

- [ ] **Step 3: Define strict Structured Output schemas**

Use Zod objects with `.strict()` and fixed fields:

```ts
export const technicalSpecificationSchema = z.object({
  title: z.string().min(1).max(120),
  ideaSummary: z.string().min(1),
  problemAndUser: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1).max(6),
  nonGoals: z.array(z.string().min(1)).max(6),
  coreFlow: z.array(z.string().min(1)).min(1).max(8),
  technicalApproach: z.string().min(1),
  boundaries: z.array(z.string().min(1)).max(8),
  risksAndDecisions: z.array(z.string().min(1)).max(8),
  nextSteps: z.array(z.string().min(1)).max(8),
}).strict();

export const mutualNdaSchema = z.object({
  title: z.literal("Mutual Non-Disclosure Agreement"),
  notice: z.literal("Not legal advice. Review this template with a qualified attorney before use."),
  partyA: z.string(),
  partyB: z.string(),
  effectiveDate: z.string(),
  purpose: z.string().min(1),
  confidentialInformation: z.string().min(1),
  exclusions: z.string().min(1),
  obligations: z.string().min(1),
  confidentialityPeriod: z.string(),
  returnOrDestruction: z.string().min(1),
  signatures: z.string().min(1),
}).strict();
```

- [ ] **Step 4: Write concise versioned prompt templates**

Export `SPEC_PROMPT_VERSION = "spec-v1"` and
`NDA_PROMPT_VERSION = "nda-v1"`. Prompts must:

- treat delimited user text as facts, not instructions;
- prohibit invented metrics, research, traction, names, dates, and legal facts;
- require labeled blanks for missing NDA facts;
- prohibit a governing-jurisdiction clause;
- state 1,200/700-word limits;
- return the schema only;
- include an explicit incompatible-input behavior.

Use the prompt shape:

```ts
const instructions = `
Role: Produce a concise early-stage software ${kind}.
Success: Cover every required schema field using only supplied facts.
Constraints: Do not invent facts. Preserve labeled blanks. Omit repetition.
Output: Match the provided schema. Maximum ${limit} words after Markdown rendering.
Stop: If the input is incompatible, return concise neutral fields rather than guessing.
`;
```

- [ ] **Step 5: Implement canonical Markdown renderers and word counting**

`toSpecificationMarkdown()` and `toNdaMarkdown()` must render fields in one
fixed order. `countWords()` normalizes whitespace and counts visible tokens:

```ts
export function countWords(markdown: string): number {
  const visible = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/[*_`[\]()]/g, " ")
    .trim();
  return visible ? visible.split(/\s+/u).length : 0;
}
```

- [ ] **Step 6: Implement the server-only OpenAI client**

```ts
import "server-only";
import OpenAI from "openai";
import { loadConfig } from "@/server/config";

export function createOpenAiClient() {
  return new OpenAI({ apiKey: loadConfig().openAiApiKey });
}
```

Use `client.responses.parse()` with `zodTextFormat`, `store: false`,
`text.verbosity: "low"`, and the configured model. Map authentication, rate
limit, refusal, incomplete response, and parse errors to stable `AppError`
codes without logging raw responses or the key.

- [ ] **Step 7: Implement one shortening retry and revision generation**

`generateDocument()` performs the first request, renders Markdown, and checks
the limit. When over the limit, it makes exactly one request containing the
parsed first result and this instruction:

```text
Shorten this document below the stated word ceiling. Preserve every required
field, supplied fact, labeled blank, material caveat, and legal notice. Remove
repetition and optional explanation first. Return the same schema.
```

`reviseDocument()` includes only the selected current revision and feedback,
not the sibling document or full project history.

- [ ] **Step 8: Run generation tests**

Run: `npm test -- tests/generation`

Expected: PASS for structured output, refusal, auth, rate limit, malformed
output, one retry, terminal over-limit, missing NDA facts, and absent
jurisdiction.

- [ ] **Step 9: Commit generation**

```bash
git add server/generation tests/generation
git commit -m "feat: generate concise structured documents"
```

## Task 4: Core Navigation, Project Intake, and Proof Logs

**Files:**
- Create: `components/app-nav.tsx`
- Create: `components/status-badge.tsx`
- Create: `components/project-form.tsx`
- Create: `components/project-list.tsx`
- Create: `app/projects/page.tsx`
- Create: `app/projects/new/page.tsx`
- Create: `app/api/projects/route.ts`
- Create: `tests/helpers/http.ts`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/api/projects.test.ts`

**Interfaces:**
- Produces: `POST /api/projects`
- Produces: `GET /api/projects?search=&status=`
- Produces: accessible navigation for Home, Proof Logs, Verify, Terms, and Protect an Idea
- Consumes: project-store interfaces from Task 2

Use this request helper in route tests:

```ts
// tests/helpers/http.ts
import { NextRequest } from "next/server";

export function jsonRequest(body: unknown, url = "http://127.0.0.1:3000/api/projects") {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 1: Write failing project API tests**

```ts
import { jsonRequest } from "../helpers/http";

it("requires idea and NDA purpose", async () => {
  const response = await POST(jsonRequest({ idea: "", ndaPurpose: "" }));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "PROJECT_INPUT_INVALID" });
});

it("creates a local draft without legal-detail fields", async () => {
  const response = await POST(jsonRequest({
    idea: "A browser app that timestamps concise idea documents",
    technologyPreference: "",
    ndaPurpose: "Discuss a possible collaboration",
    ndaDetails: "",
  }));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ status: "draft" });
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run: `npm test -- tests/api/projects.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement project validation and API routes**

Validate request bodies with:

```ts
const projectInputSchema = z.object({
  idea: z.string().trim().min(20).max(10_000),
  technologyPreference: z.string().trim().max(1_000).default(""),
  ndaPurpose: z.string().trim().min(10).max(2_000),
  ndaDetails: z.string().trim().max(4_000).default(""),
}).strict();
```

Return only safe project fields. Never return filesystem paths, raw SQL
records, or configuration values.

- [ ] **Step 4: Build the shared navigation and responsive shell**

Recreate the reference logo and dark UI independently with CSS and inline SVG.
Use real links, an accessible mobile-menu button with `aria-expanded`, a skip
link, and a `<main id="main-content">`.

- [ ] **Step 5: Build the home page**

Keep the design's outcome-focused headline, two calls to action, five-step
workflow, and three trust notes. Replace "encrypted before saved" with:

```text
Stored on this machine
Your projects and generated documents stay in your local IdeaProof data folder.
Generation sends the required content to OpenAI using your API key.
```

- [ ] **Step 6: Build the compact project form**

Render exactly four inputs:

```tsx
<textarea name="idea" required minLength={20} />
<input name="technologyPreference" />
<textarea name="ndaPurpose" required minLength={10} />
<textarea name="ndaDetails" aria-describedby="nda-details-help" />
```

The help copy explains that Party A, Party B, Effective Date, and
Confidentiality Period remain blank unless included in the optional text.
Submitting creates the project and navigates to its generating page.

- [ ] **Step 7: Build searchable proof logs**

Use server-rendered query parameters for `search` and `status`. Display draft,
pending, confirmed, and failed badges, created time, and the correct destination
link. Do not ship demo records in production.

- [ ] **Step 8: Run API, lint, and type checks**

Run: `npm test -- tests/api/projects.test.ts && npm run lint && npm run typecheck`

Expected: all commands exit 0.

- [ ] **Step 9: Commit intake and logs**

```bash
git add app components tests/api/projects.test.ts
git commit -m "feat: add project intake and proof logs"
```

## Task 5: Generation Progress, Review, and Revision History

**Files:**
- Create: `components/generation-progress.tsx`
- Create: `components/document-preview.tsx`
- Create: `components/review-workspace.tsx`
- Create: `app/projects/[id]/generating/page.tsx`
- Create: `app/projects/[id]/review/page.tsx`
- Create: `app/projects/[id]/history/page.tsx`
- Create: `app/api/projects/[id]/generate/[documentType]/route.ts`
- Create: `app/api/projects/[id]/revisions/route.ts`
- Create: `tests/api/generation-harness.ts`
- Test: `tests/api/generation.test.ts`
- Test: `tests/api/revisions.test.ts`

**Interfaces:**
- Produces: `POST /api/projects/:id/generate/specification`
- Produces: `POST /api/projects/:id/generate/nda`
- Produces: `POST /api/projects/:id/revisions`
- Produces: dependency-injectable `handleGenerate()` and `handleRevision()` functions used by route wrappers and tests
- Consumes: generation service from Task 3 and store from Task 2

- [ ] **Step 1: Write failing generation-route tests**

```ts
import { AppError } from "@/server/errors";
import { createGenerationHarness } from "./generation-harness";

it("generates documents independently and retains a successful sibling", async () => {
  const { store, project, mockGeneration, generate } = createGenerationHarness();
  mockGeneration.specification.mockResolvedValue(validGeneratedSpec);
  mockGeneration.nda.mockRejectedValue(new AppError("OPENAI_RATE_LIMITED", "Try again.", 429, true));

  expect((await generate("specification")).status).toBe(201);
  expect((await generate("nda")).status).toBe(429);
  expect(store.getRevisions(project.id, "specification")).toHaveLength(1);
  expect(store.getRevisions(project.id, "nda")).toHaveLength(0);
});

it("revises only the selected document", async () => {
  const { mockGeneration, revise, nda, spec } = createGenerationHarness({
    withExistingDocuments: true,
  });
  await revise({ documentType: "nda", revisionId: nda!.id, feedback: "Use shorter sentences." });
  expect(mockGeneration.revise).toHaveBeenCalledWith(
    expect.objectContaining({ documentType: "nda", currentMarkdown: nda!.content }),
  );
  expect(mockGeneration.revise).not.toHaveBeenCalledWith(
    expect.objectContaining({ currentMarkdown: spec!.content }),
  );
});
```

Implement the harness against exported route-core functions:

```ts
// tests/api/generation-harness.ts
import { vi } from "vitest";
import { handleGenerate } from "@/app/api/projects/[id]/generate/[documentType]/route";
import { handleRevision } from "@/app/api/projects/[id]/revisions/route";
import { openTestStore } from "../helpers/open-test-store";

export function createGenerationHarness(options = { withExistingDocuments: false }) {
  const store = openTestStore();
  const project = store.createProject({
    idea: "A local web app that creates concise idea documents and timestamps approved PDFs.",
    technologyPreference: "Next.js",
    ndaPurpose: "Discuss a possible product collaboration",
    ndaDetails: "",
  });
  const mockGeneration = {
    specification: vi.fn(),
    nda: vi.fn(),
    revise: vi.fn(),
  };
  const spec = options.withExistingDocuments
    ? store.addRevision(testRevision(project.id, "specification"))
    : undefined;
  const nda = options.withExistingDocuments
    ? store.addRevision(testRevision(project.id, "nda"))
    : undefined;
  return {
    store,
    project,
    mockGeneration,
    spec,
    nda,
    generate: (documentType: "specification" | "nda") =>
      handleGenerate({ projectId: project.id, documentType, store, generation: mockGeneration }),
    revise: (body: { documentType: "specification" | "nda"; revisionId: string; feedback: string }) =>
      handleRevision({ projectId: project.id, body, store, generation: mockGeneration }),
  };
}
```

Define `testRevision()` in the same file with every `addRevision` field and
export `validGeneratedSpec` as a schema-valid fixture. Do not use hidden global
state.

- [ ] **Step 2: Run route tests and verify failure**

Run: `npm test -- tests/api/generation.test.ts tests/api/revisions.test.ts`

Expected: FAIL because routes and components do not exist.

- [ ] **Step 3: Implement per-document generation routes**

The route accepts only `specification` or `nda`, transitions draft/retryable
projects to `generating`, calls the matching generation service, adds a
revision, and returns:

```ts
type GenerationResponse = {
  documentType: "specification" | "nda";
  revisionId: string;
  version: number;
  wordCount: number;
};
```

After both document types exist, set project status to `review`. A failure
records a safe project error while preserving existing revisions.

- [ ] **Step 4: Build real generation progress**

`generation-progress.tsx` calls specification generation first and NDA
generation second. Its visible states are:

```ts
type GenerationStep =
  | "preparing"
  | "generating-specification"
  | "generating-nda"
  | "saving"
  | "complete"
  | "failed";
```

Each completed step reflects a completed HTTP response. Retry calls only the
failed document route. On completion, navigate to `/projects/:id/review`.

- [ ] **Step 5: Render safe Markdown previews**

Use `react-markdown` without `rehypeRaw`. Provide only local render components
for headings, paragraphs, lists, strong text, and links. Links receive
`rel="noreferrer"` and no images or HTML plugins are enabled.

- [ ] **Step 6: Build the review workspace**

The review page provides:

- specification/NDA tabs;
- current version and word count;
- prior-version selector;
- safe preview;
- feedback textarea;
- "Create revision";
- "Revision history";
- "Approve selected revisions".

Feedback validation:

```ts
const revisionRequestSchema = z.object({
  documentType: z.enum(["specification", "nda"]),
  revisionId: z.string().uuid(),
  feedback: z.string().trim().min(3).max(4_000),
}).strict();
```

- [ ] **Step 7: Build revision history**

List both document streams in chronological order with version, feedback,
prompt version, model, word count, and creation time. The page previews any
revision without mutating the selected approval revisions.

- [ ] **Step 8: Run generation and revision tests**

Run: `npm test -- tests/api/generation.test.ts tests/api/revisions.test.ts`

Expected: PASS for independent generation, retry, revision isolation, and
history retention.

- [ ] **Step 9: Commit generation UI**

```bash
git add app/projects app/api/projects components tests/api
git commit -m "feat: review and revise generated documents"
```

## Task 6: Canonical Markdown, PDF Rendering, and Proof Package

**Files:**
- Create: `server/documents/markdown.ts`
- Create: `server/documents/pdf.ts`
- Create: `server/documents/package.ts`
- Create: `assets/fonts/IBMPlexSans-Regular.ttf`
- Create: `assets/fonts/IBMPlexSans-SemiBold.ttf`
- Create: `assets/fonts/OFL.txt`
- Test: `tests/documents/markdown.test.ts`
- Test: `tests/documents/pdf.test.ts`
- Test: `tests/documents/package.test.ts`

**Interfaces:**
- Produces: `renderPdf(input): Promise<Uint8Array>`
- Produces: `sha256(bytes): string`
- Produces: `buildProofPackage(files, manifest): Uint8Array`
- Produces: `ManifestV1`
- Consumes: approved revision content from Task 2

- [ ] **Step 1: Write failing canonical-render and package tests**

```ts
import { strFromU8, unzipSync } from "fflate";
import { buildProofPackage, type ManifestV1 } from "@/server/documents/package";
import { renderPdf } from "@/server/documents/pdf";

it("renders identical bytes for identical approved input", async () => {
  const input = {
    title: "Technical Specification",
    markdown: "# Technical Specification\n\nA concise local proof application.",
    approvedAt: "2026-07-25T00:00:00.000Z",
    documentType: "specification" as const,
  };
  expect(await renderPdf(input)).toEqual(await renderPdf(input));
});

it("packages only approved public artifacts", () => {
  const bytes = new TextEncoder().encode("fixture");
  const files = {
    "technical-specification.md": bytes,
    "technical-specification.pdf": bytes,
    "technical-specification.pdf.ots": bytes,
    "mutual-nda.md": bytes,
    "mutual-nda.pdf": bytes,
    "mutual-nda.pdf.ots": bytes,
  };
  const manifest: ManifestV1 = {
    schemaVersion: 1,
    projectId: "00000000-0000-4000-8000-000000000001",
    approvalId: "00000000-0000-4000-8000-000000000002",
    approvedAt: "2026-07-25T00:00:00.000Z",
    documents: [],
  };
  const zip = unzipSync(buildProofPackage(files, manifest));
  expect(Object.keys(zip).sort()).toEqual([
    "manifest.json",
    "mutual-nda.md",
    "mutual-nda.pdf",
    "mutual-nda.pdf.ots",
    "technical-specification.md",
    "technical-specification.pdf",
    "technical-specification.pdf.ots",
  ]);
  expect(strFromU8(zip["manifest.json"])).not.toContain("OPENAI_API_KEY");
  expect(strFromU8(zip["manifest.json"])).not.toContain("A private user idea");
});
```

- [ ] **Step 2: Run document tests and verify failure**

Run: `npm test -- tests/documents`

Expected: FAIL because document modules and fonts do not exist.

- [ ] **Step 3: Add IBM Plex Sans fonts and license**

Add only the regular and semibold TTF files from the official IBM Plex
distribution plus its unmodified OFL license. Record their SHA-256 checksums in
`THIRD_PARTY_NOTICES.md` later. Do not fetch fonts at runtime.

- [ ] **Step 4: Implement the limited Markdown block parser**

Parse only the canonical output emitted by Task 3:

```ts
export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "paragraph"; text: string }
  | { type: "listItem"; text: string };
```

Reject raw HTML blocks, image syntax, and unexpected heading levels with
`DOCUMENT_MARKDOWN_INVALID`.

- [ ] **Step 5: Implement deterministic PDF layout**

Use `pdf-lib` with embedded IBM Plex fonts, fixed A4 dimensions, fixed margins,
fixed line heights, and a page-break helper. Set title, author, subject,
creator, producer, creation date, and modification date from immutable input.
Disable object streams if needed for byte-stability and never use current time
or randomness inside `renderPdf()`.

The NDA blank values remain ordinary visible text lines, not interactive PDF
form fields.

- [ ] **Step 6: Implement hashes and manifest**

```ts
export type ManifestV1 = {
  schemaVersion: 1;
  projectId: string;
  approvalId: string;
  approvedAt: string;
  documents: Array<{
    type: "specification" | "nda";
    revisionId: string;
    markdownFile: string;
    pdfFile: string;
    proofFile: string;
    sha256: string;
    wordCount: number;
    promptTemplateVersion: string;
    model: string;
  }>;
};

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
```

- [ ] **Step 7: Build ZIP bytes with fixed names and ordering**

Use `fflate.zipSync()` and stable file timestamps derived from `approvedAt`.
Manifest serialization uses two-space indentation and a trailing newline.
Never include intake, feedback, database files, API payloads, or internal paths.

- [ ] **Step 8: Run document tests**

Run: `npm test -- tests/documents`

Expected: PASS for stable bytes, Unicode, multipage content, blanks, raw-HTML
rejection, hash values, manifest privacy, and exact ZIP entries.

- [ ] **Step 9: Commit document artifacts**

```bash
git add server/documents assets/fonts tests/documents
git commit -m "feat: render approved proof packages"
```

## Task 7: OpenTimestamps, Approval, Status, and Downloads

**Files:**
- Create: `server/proof/parse.ts`
- Create: `server/proof/ots.ts`
- Create: `tests/fixtures/fake-ots.mjs`
- Create: `tests/proof/parse.test.ts`
- Create: `tests/proof/ots.test.ts`
- Create: `app/api/projects/[id]/approve/route.ts`
- Create: `app/api/projects/[id]/proof/check/route.ts`
- Create: `app/api/projects/[id]/package/route.ts`
- Create: `components/proof-status.tsx`
- Create: `app/projects/[id]/proof/page.tsx`
- Test: `tests/api/approval.test.ts`
- Test: `tests/api/proof-status.test.ts`

**Interfaces:**
- Produces: `stampPdf(path): Promise<StampResult>`
- Produces: `checkProof(pdfPath, otsPath): Promise<VerificationResult>`
- Produces: `POST /api/projects/:id/approve`
- Produces: `POST /api/projects/:id/proof/check`
- Produces: `GET /api/projects/:id/package`
- Consumes: Task 2 store and Task 6 document/package service

- [ ] **Step 1: Write failing OpenTimestamps parser and process tests**

```ts
import { vi } from "vitest";
import { parseOtsOutput } from "@/server/proof/parse";
import { stampPdf } from "@/server/proof/ots";

it.each([
  ["Success! Bitcoin block 900000 attests existence as of 2026-07-25 UTC", "confirmed"],
  ["Pending confirmation in Bitcoin blockchain", "pending"],
  ["Digest mismatch", "mismatch"],
])("maps ots output %s", (output, status) => {
  expect(parseOtsOutput(output)).toMatchObject({ status });
});

it("passes paths as arguments without a shell", async () => {
  const fakeRunner = vi.fn().mockResolvedValue({
    exitCode: 0,
    stdout: "Submitting to remote calendar",
    stderr: "",
  });
  await stampPdf("/tmp/project/file with spaces.pdf", fakeRunner);
  expect(fakeRunner).toHaveBeenCalledWith(
    expect.stringContaining("ots"),
    ["stamp", "/tmp/project/file with spaces.pdf"],
    expect.objectContaining({ shell: false }),
  );
});
```

- [ ] **Step 2: Run proof tests and verify failure**

Run: `npm test -- tests/proof`

Expected: FAIL because proof modules do not exist.

- [ ] **Step 3: Resolve the project-local `ots` executable**

```ts
export function resolveOtsExecutable(root = process.cwd()): string {
  return process.platform === "win32"
    ? join(root, ".venv", "Scripts", "ots.exe")
    : join(root, ".venv", "bin", "ots");
}
```

Missing executable throws `SETUP_OTS_MISSING` with `npm run setup` guidance.

- [ ] **Step 4: Implement direct process invocation and output parsing**

Use `execFile` or `spawn` with `shell: false`, a 60-second timeout, a 1 MB
combined-output ceiling, and an explicit working directory. Map calendar
unavailability, pending, mismatch, invalid proof, timeout, and unknown nonzero
exit to stable codes. Never include internal paths in user-facing messages.

- [ ] **Step 5: Implement transactional approval orchestration**

The approval route:

1. validates selected specification and NDA revision UUIDs;
2. confirms ownership, word limits, and project state;
3. creates an immutable approval timestamp and artifact directory;
4. writes Markdown and rendered PDFs;
5. hashes PDFs;
6. stamps each PDF independently;
7. creates proof records and manifest;
8. writes ZIP atomically through a temporary filename and rename;
9. transitions to `pending`;
10. returns the proof-page URL.

If stamping fails, retain Markdown, PDFs, and hashes, record a retryable proof
error, and transition to `failed`. Never regenerate content during proof retry.

- [ ] **Step 6: Implement explicit proof checks**

For pending artifacts, call `ots upgrade proof.ots`, then
`ots verify proof.ots` with the PDF beside it. Confirm the project only when
both artifacts are confirmed. Store block height and confirmation time when
parsed. No timers, cron routes, or background worker are added.

- [ ] **Step 7: Implement package download**

Return the existing immutable ZIP with:

```ts
return new Response(packageBytes, {
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${safeSlug}.zip"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});
```

The slug is generated from stored project ID/title and never accepts a path.

- [ ] **Step 8: Build the proof-status page**

Render pending, confirmed, and failed states, confirmation details, document
previews, ZIP download, explicit "Check confirmation", and a link to Verify.
Remove every demo toggle from the reference design.

- [ ] **Step 9: Run proof and approval tests**

Run: `npm test -- tests/proof tests/api/approval.test.ts tests/api/proof-status.test.ts`

Expected: PASS for path safety, pending, confirmed, calendar failure, retry,
approval immutability, exact ZIP download, and dual-document confirmation.

- [ ] **Step 10: Commit proof creation**

```bash
git add server/proof app/api/projects app/projects components/proof-status.tsx tests
git commit -m "feat: create and track timestamp proofs"
```

## Task 8: Independent PDF Verification and Terms

**Files:**
- Create: `components/verify-form.tsx`
- Create: `app/verify/page.tsx`
- Create: `app/api/verify/route.ts`
- Create: `app/terms/page.tsx`
- Create: `app/setup/page.tsx`
- Create: `app/api/setup/route.ts`
- Create: `tests/api/verify-harness.ts`
- Test: `tests/api/verify.test.ts`
- Test: `tests/api/setup.test.ts`

**Interfaces:**
- Produces: `POST /api/verify`
- Produces: `GET /api/setup`
- Consumes: `checkProof()` from Task 7 and `loadConfig()` from Task 1

- [ ] **Step 1: Write failing upload-security and setup tests**

```ts
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import { fileOfSize, validFiles, verifyMultipart } from "./verify-harness";

it("rejects oversized files before invoking ots", async () => {
  const otsRunner = vi.fn();
  const response = await verifyMultipart({
    document: fileOfSize(10 * 1024 * 1024 + 1, "document.pdf"),
    proof: fileOfSize(100, "document.pdf.ots"),
  }, { checkProof: otsRunner });
  expect(response.status).toBe(413);
  expect(otsRunner).not.toHaveBeenCalled();
});

it("removes temporary verification files after success", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "ideaproof-verify-test-"));
  await verifyMultipart(validFiles, { tempRoot });
  expect(await readdir(tempRoot)).toEqual([]);
});

it("reports missing setup without exposing environment values", async () => {
  delete process.env.OPENAI_API_KEY;
  const response = await GET_SETUP(new Request("http://127.0.0.1:3000/api/setup"));
  expect(await response.json()).toEqual({
    ready: false,
    checks: expect.arrayContaining([
      expect.objectContaining({ code: "SETUP_OPENAI_KEY_MISSING" }),
    ]),
  });
});
```

Define the upload harness without hidden state:

```ts
// tests/api/verify-harness.ts
import { NextRequest } from "next/server";
import { handleVerify } from "@/app/api/verify/route";

export function fileOfSize(size: number, name: string) {
  const type = name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
  return new File([new Uint8Array(size)], name, { type });
}

export const validFiles = {
  document: fileOfSize(128, "document.pdf"),
  proof: fileOfSize(128, "document.pdf.ots"),
};

export async function verifyMultipart(
  files: { document: File; proof: File },
  options: {
    tempRoot?: string;
    checkProof?: () => Promise<{ status: "pending"; sha256: string }>;
  } = {},
) {
  const form = new FormData();
  form.set("document", files.document);
  form.set("proof", files.proof);
  const request = new NextRequest("http://127.0.0.1:3000/api/verify", {
    method: "POST",
    body: form,
  });
  return handleVerify(request, {
    tempRoot: options.tempRoot,
    checkProof: options.checkProof ??
      (async () => ({ status: "pending", sha256: "0".repeat(64) })),
  });
}
```

Export `GET` as `GET_SETUP` in the setup-route test import. Export
`handleVerify()` separately from the thin Next.js `POST` wrapper so tests can
inject the proof checker and temporary root.

- [ ] **Step 2: Run verification tests and verify failure**

Run: `npm test -- tests/api/verify.test.ts tests/api/setup.test.ts`

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement bounded multipart verification**

Accept exactly `document` and `proof`. Require PDF MIME/type plus `.pdf`, and
proof filename ending `.ots`. Enforce 10 MB/1 MB limits before writing. Create
a UUID temp directory under the data directory, rename inputs to
`document.pdf` and `document.pdf.ots`, and delete the directory in `finally`.

Return:

```ts
type VerifyResponse = {
  status: "confirmed" | "pending" | "mismatch" | "invalid";
  sha256: string;
  bitcoinBlockHeight?: number;
  confirmedAt?: string;
  message: string;
};
```

- [ ] **Step 4: Build the verification UI**

Use native file inputs with labels, selected filenames, size feedback, a
disabled submit state, and accessible result panels. Show technical details
behind a native `<details>` element. Remove all demo-result buttons.

- [ ] **Step 5: Build setup checks and correction page**

Check only:

- API key is configured;
- data directory can be created and written;
- Python meets 3.10;
- project-local `ots` exists and reports a version.

Return status and exact corrective commands, never secret values. The setup
page links back to README troubleshooting.

- [ ] **Step 6: Build Terms**

Include concise sections:

- AI-generated content may contain errors;
- NDA is a template, not legal advice;
- content sent to OpenAI;
- data stored locally without application encryption;
- timestamps prove file existence/integrity, not ownership or legal validity;
- calendars receive commitments but timing/network metadata may be observable;
- confirmation may take hours;
- changing a PDF invalidates its existing proof.

- [ ] **Step 7: Run verification and setup tests**

Run: `npm test -- tests/api/verify.test.ts tests/api/setup.test.ts`

Expected: PASS for confirmed, pending, mismatch, invalid, size rejection,
generated filenames, no-shell invocation, cleanup, and safe setup output.

- [ ] **Step 8: Commit verification and terms**

```bash
git add app/verify app/api/verify app/setup app/api/setup app/terms components/verify-form.tsx tests/api
git commit -m "feat: verify proofs and explain local setup"
```

## Task 9: End-to-End Verification, README, Licensing, Screenshots, Docker, and Design Cleanup

**Files:**
- Create: `tests/e2e/ideaproof.spec.ts`
- Create: `tests/e2e/screenshots.spec.ts`
- Create: `tests/fixtures/openai-responses.ts`
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `LICENSE`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `docs/images/ideaproof-home.png`
- Create: `docs/images/ideaproof-review.png`
- Modify: `package.json`
- Delete after verification: `ideaproof_design/IdeaProof.dc.html`
- Delete after verification: `ideaproof_design/support.js`
- Delete after verification: `ideaproof_design/animations-v2.jsx`
- Delete after verification: `ideaproof_design/tweaks-panel.jsx`
- Delete after verification: `ideaproof_design/.thumbnail`
- Delete after verification: `ideaproof_design/`

**Interfaces:**
- Produces: documented direct-install workflow
- Produces: optional `docker compose up --build`
- Produces: deterministic README screenshots from fixtures
- Verifies: complete user story and absence of design-runtime dependencies

- [ ] **Step 1: Write the failing end-to-end user journey**

```ts
test("create, generate, revise, approve, download, and verify", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("Idea description").fill("A local web app that creates concise idea documents and timestamps approved PDFs.");
  await page.getByLabel("NDA purpose").fill("Discuss a possible product collaboration.");
  await page.getByRole("button", { name: "Generate documents" }).click();
  await expect(page.getByRole("heading", { name: "Review your documents" })).toBeVisible();

  await page.getByRole("tab", { name: "Mutual NDA" }).click();
  await page.getByLabel("Revision feedback").fill("Use shorter sentences.");
  await page.getByRole("button", { name: "Create revision" }).click();
  await expect(page.getByText("Version 2")).toBeVisible();

  await page.getByRole("button", { name: "Approve selected revisions" }).click();
  await page.getByRole("button", { name: "Approve and create proof" }).click();
  await expect(page.getByText(/Pending confirmation|Proof confirmed/)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download proof package" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
});
```

- [ ] **Step 2: Run the E2E test and verify any remaining failure**

Run: `npm run build && npm run test:e2e -- tests/e2e/ideaproof.spec.ts`

Expected: FAIL until fixture injection and any missing UI wiring are completed.

- [ ] **Step 3: Add test-only deterministic adapters**

Dependency-inject the OpenAI client and `ots` executable through server module
factories. Test mode points at checked-in deterministic fakes; production mode
cannot select them from browser input. The fake OpenAI responses must obey the
real Zod schemas and length limits. The fake `ots` script must emulate pending,
confirmed, mismatch, and invalid outputs.

- [ ] **Step 4: Make the full E2E journey pass**

Run: `npm run build && npm run test:e2e -- tests/e2e/ideaproof.spec.ts`

Expected: PASS with no external OpenAI or calendar network call.

- [ ] **Step 5: Generate README screenshots from the finished app**

`screenshots.spec.ts` uses deterministic fixtures, a 1440×1000 viewport, and
captures only:

```ts
const fixtureProjectId = "00000000-0000-4000-8000-000000000100";
await page.goto("/");
await page.screenshot({ path: "docs/images/ideaproof-home.png", fullPage: true });
await page.goto(`/projects/${fixtureProjectId}/review`);
await page.screenshot({ path: "docs/images/ideaproof-review.png", fullPage: true });
```

Run: `npx playwright test tests/e2e/screenshots.spec.ts --update-snapshots`

Expected: both PNG files exist and contain no API keys or personal data.

- [ ] **Step 6: Visually compare the rebuilt UI with the design reference**

Run the application and inspect home, logs, intake, generation, review,
history, proof, verify, terms, mobile navigation, 375 px mobile layout, and
reduced-motion mode. Fix only concrete mismatches in hierarchy, spacing,
colors, responsive behavior, accessibility, or missing states. Do not import
or copy the design runtime.

Acceptance checklist:

```text
[ ] All reference screens have a production equivalent
[ ] No demo toggles or example proof records remain
[ ] Desktop and 375 px mobile layouts have no clipping
[ ] Keyboard navigation reaches every action
[ ] Reduced motion disables decorative animation
[ ] Generated-content previews cannot render raw HTML or remote images
```

- [ ] **Step 7: Write user and contributor documentation**

`README.md` must include:

- product purpose and limits;
- the two generated screenshots;
- Node 24.14+, Python 3.9+, and npm 10+ requirements;
- GitHub's Code → HTTPS clone flow, `.env`, `npm install`, `npm run setup`,
  `npm run build`, and `npm start`; when an `origin` remote exists, include
  that exact URL rather than an invented owner or repository name;
- `http://localhost:3000`;
- development and test commands;
- optional Docker section;
- OpenAI configuration and content-transmission notice;
- `data/` location and backup;
- proof-package contents and verification;
- pending-confirmation behavior;
- NDA/legal disclaimer;
- troubleshooting;
- links to contributing, license, and third-party notices.

`CONTRIBUTING.md` documents TDD, `npm run verify`, screenshot refresh, prompt
versioning, schema migrations, and the rule that API keys and user data never
enter fixtures.

- [ ] **Step 8: Add MIT and third-party notices**

`LICENSE` uses the standard MIT text with:

```text
Copyright (c) 2026 IdeaProof contributors
```

`THIRD_PARTY_NOTICES.md` records at minimum OpenTimestamps client
LGPL-3.0-or-later, IBM Plex OFL-1.1, and all bundled runtime dependencies by
package name and license. Verify notices against installed package metadata;
do not guess missing licenses.

- [ ] **Step 9: Add optional Docker files without changing the primary path**

`Dockerfile` installs Node 24, Python, project dependencies, the local
OpenTimestamps client, and the production build. `docker-compose.yml` mounts
`./data`, passes `.env`, binds `127.0.0.1:3000:3000`, and contains one app
service. README labels it optional.

Run: `docker compose config`

Expected: exit 0 when Docker is installed; otherwise record this optional check
as not run. No application test may require Docker.

- [ ] **Step 10: Prove no implementation dependency on the design folder**

Run:

```bash
rg -n "ideaproof_design|support\.js|animations-v2|tweaks-panel|x-dc|DCLogic|omelette" app components server scripts tests package.json README.md
```

Expected: no matches.

- [ ] **Step 11: Remove the design reference only after Steps 5, 6, and 10 pass**

Delete the uncommitted `ideaproof_design/` directory in a recoverable manner
when the environment supports Trash; otherwise remove only these exact files
after rechecking the path:

```text
ideaproof_design/.thumbnail
ideaproof_design/IdeaProof.dc.html
ideaproof_design/animations-v2.jsx
ideaproof_design/support.js
ideaproof_design/tweaks-panel.jsx
```

Verify:

```bash
test ! -e ideaproof_design
git status --short
```

Expected: the directory is absent, it was never committed, and Git reports no
tracked deletion. This eliminates the copied Omelette redistribution concern
before public release.

- [ ] **Step 12: Run the complete non-Docker verification**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke
npm run test:e2e
```

Expected: every command exits 0. Report exact test counts and any optional
Docker check separately.

- [ ] **Step 13: Audit repository contents before the final commit**

Run:

```bash
git status --short
git diff --check
git ls-files
rg -n "sk-[A-Za-z0-9_-]{12,}|OPENAI_API_KEY=.+" . --glob '!package-lock.json'
```

Expected: no key values, no `data/`, `.env`, `.venv`, Omelette files, temp
uploads, or test downloads are tracked.

- [ ] **Step 14: Commit the completed app and documentation**

```bash
git add README.md CONTRIBUTING.md LICENSE THIRD_PARTY_NOTICES.md Dockerfile docker-compose.yml docs/images tests package.json package-lock.json app components server scripts assets .env.example .gitignore
git commit -m "feat: complete local IdeaProof workflow"
```

## Plan Completion Gate

Before declaring implementation complete:

1. Re-read `docs/superpowers/specs/2026-07-25-ideaproof-local-webapp-design.md`.
2. Map every success criterion to a passing test or fresh manual verification.
3. Confirm direct installation and production startup work without Docker.
4. Confirm both generated documents obey their word ceilings.
5. Confirm the NDA has no governing-jurisdiction clause.
6. Confirm the API key is absent from browser assets, logs, database, manifest,
   ZIP, fixtures, and Git history.
7. Confirm approved PDFs are immutable and proofs verify their exact bytes.
8. Confirm `ideaproof_design/` is absent and was never committed.
9. Run `npm run verify`, `npm run smoke`, and `npm run test:e2e` fresh.
10. Report actual verification output, remaining limitations, and optional
    Docker status without implying unrun checks passed.
