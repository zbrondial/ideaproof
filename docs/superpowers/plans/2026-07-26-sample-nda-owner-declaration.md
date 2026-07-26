# Sample NDA and Owner Declaration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the NDA to “Sample NDA” everywhere users see or download it, and place a locally stored, affirmatively confirmed owner declaration in every newly approved technical-specification PDF.

**Architecture:** Add `owner_name` to local projects through an additive SQLite migration and require it only for new project creation. Keep provider-generated revision Markdown free of personal attribution; a focused document helper appends the declaration at display and approval-package boundaries. Continue using the internal `nda` document type, while new public package filenames become `sample-nda.*`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Node SQLite, Zod 4, Vitest, Playwright, pdf-lib, OpenTimestamps.

## Global Constraints

- Use `Owner’s full name` as the required intake label, with 1–120 trimmed characters and no line breaks or Markdown control characters.
- Never send `ownerName` to OpenAI or Anthropic.
- Render exactly one `Prepared and claimed by` declaration in technical-specification previews, approved Markdown, and approved PDFs for new projects.
- Require `I confirm that I prepared and claim ownership of this documented idea.` before a first approval for projects with an owner name; do not require it for legacy projects or timestamp retries.
- Use “Sample NDA” for short labels and “Sample Non-Disclosure Agreement” for generated/PDF titles.
- New packages use `sample-nda.md`, `sample-nda.pdf`, and `sample-nda.pdf.ots`; existing stored packages remain untouched.
- Keep the internal document type `nda` and preserve legacy projects whose owner name is empty.
- Increment `SPEC_PROMPT_VERSION` to `spec-v3` for the attribution contract and `NDA_PROMPT_VERSION` to `nda-v3` for the Sample NDA contract.
- Preserve the 1,000-word specification ceiling, 700-word NDA ceiling, blank NDA facts, provider immutability, and real OpenTimestamps behavior.

---

### Task 1: Persist the Required Owner Name Locally

**Files:**
- Create: `server/db/migrations/003-project-owner-name.sql`
- Modify: `server/db/projects.ts`
- Modify: `app/api/projects/route.ts`
- Modify: `components/project-form.tsx`
- Modify: `tests/db/projects.test.ts`
- Modify: `tests/api/projects.test.ts`
- Modify: `tests/ui/copy-contract.test.tsx`

**Interfaces:**
- Consumes: the existing `Project`, `ProjectRow`, `createProject()`, and `/api/projects` contracts.
- Produces: `Project.ownerName: string` and optional store input `createProject({ ownerName?: string, ... })`; the public API requires it, while legacy rows and internal fixtures default to `ownerName === ""`.

- [ ] **Step 1: Write failing migration and storage tests**

Extend the existing legacy-migration test in `tests/db/projects.test.ts` so a
database upgraded through migration 003 returns `ownerName: ""`. Add a
project-store assertion:

```ts
const project = store.createProject({
  ownerName: "Ada Lovelace",
  idea: "A local proof app for early product specifications",
  technologyPreference: "Next.js",
  ndaPurpose: "Discuss a possible collaboration",
  provider: "openai",
  model: "gpt-5.6",
});

expect(project.ownerName).toBe("Ada Lovelace");
```

The existing test starts from migration 001 and exercises migrations 002 and
003 in order, covering the real upgrade path.

- [ ] **Step 2: Write failing route and form tests**

Extend the project API fixture with `ownerName: "Ada Lovelace"`. Assert a
successful response persists that value. Add table cases for `ownerName: ""`,
`ownerName: "A".repeat(121)`, a newline, and Markdown control characters such
as `"**Ada**"`; each must return `400` and
`{ code: "PROJECT_INPUT_INVALID" }`.

Render `ProjectForm` and assert it contains:

```html
<label for="ownerName">Owner’s full name</label>
```

and help copy:

```text
This name appears on the technical specification and becomes part of its timestamped PDF.
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npx vitest run tests/db/projects.test.ts tests/api/projects.test.ts tests/ui/copy-contract.test.tsx
```

Expected: FAIL because migration 003, `ownerName`, and the form field do not
exist.

- [ ] **Step 4: Add the additive migration and project mapping**

Create:

```sql
ALTER TABLE projects
ADD COLUMN owner_name TEXT NOT NULL DEFAULT '';
```

Add `ownerName: string` to `Project`, `owner_name: string` to `ProjectRow`, map
it in `projectFromRow()`, accept optional `ownerName?: string` in
`createProject()`, insert `input.ownerName ?? ""`, and include `owner_name` in
the insert.

- [ ] **Step 5: Validate and submit the owner name**

Add this reusable field schema beside `projectInputSchema`:

```ts
const ownerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,'’\-]*$/u);
```

Add `ownerName: ownerNameSchema` to the route schema. In `ProjectForm.submit()`,
send `ownerName: form.get("ownerName")`. Place this required input immediately
before `Raw software idea`:

```tsx
<div className="field">
  <label htmlFor="ownerName">Owner’s full name</label>
  <input
    id="ownerName"
    name="ownerName"
    required
    minLength={1}
    maxLength={120}
    autoComplete="name"
    aria-describedby="owner-name-help"
    placeholder="For example: Ada Lovelace"
  />
  <p className="field-help" id="owner-name-help">
    This name appears on the technical specification and becomes part of its
    timestamped PDF.
  </p>
</div>
```

Update the safe route error message to mention the owner name without echoing
submitted input.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/db/projects.test.ts tests/api/projects.test.ts tests/ui/copy-contract.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/db/migrations/003-project-owner-name.sql server/db/projects.ts app/api/projects/route.ts components/project-form.tsx tests/db/projects.test.ts tests/api/projects.test.ts tests/ui/copy-contract.test.tsx
git commit -m "feat: store the declared idea owner"
```

---

### Task 2: Append Attribution Without Sending It to AI Providers

**Files:**
- Create: `server/documents/attribution.ts`
- Create: `tests/documents/attribution.test.ts`
- Modify: `app/projects/[id]/review/page.tsx`
- Modify: `app/projects/[id]/proof/page.tsx`
- Modify: `app/api/projects/[id]/approve/route.ts`
- Modify: `server/generation/prompts.ts`
- Modify: `tests/api/generation.test.ts`
- Modify: `tests/api/revisions.test.ts`
- Modify: `tests/api/approval.test.ts`

**Interfaces:**
- Consumes: `Project.ownerName`, raw provider-generated specification Markdown, and the existing approval renderer.
- Produces: `withOwnerDeclaration(markdown: string, ownerName: string): string`, returning unchanged Markdown for legacy empty names.

- [ ] **Step 1: Write failing attribution tests**

Create literal behavior tests:

```ts
expect(
  withOwnerDeclaration("# Specification\n\nBody.\n", "Ada Lovelace"),
).toBe(`# Specification

Body.

---

**Prepared and claimed by:** Ada Lovelace

The named person declares that they prepared and claim ownership of this documented idea.
`);

expect(withOwnerDeclaration("# Legacy\n", "")).toBe("# Legacy\n");
expect(
  withOwnerDeclaration(
    withOwnerDeclaration("# Specification\n", "Ada Lovelace"),
    "Ada Lovelace",
  ).match(/Prepared and claimed by/g),
).toHaveLength(1);
```

The production mutation these tests catch is missing, duplicated, or altered
attribution text.

- [ ] **Step 2: Write failing privacy and approval-artifact tests**

In generation and revision API tests, create a project with the sentinel owner
`"Private Owner Sentinel"`. Capture the real generation input/prompt boundary
and assert neither initial generation nor revision provider input contains the
sentinel.

In the approval test, wrap the real PDF renderer and capture its input:

```ts
const rendered: Array<Parameters<typeof renderDocumentPdf>[0]> = [];
const renderPdf: typeof renderDocumentPdf = async (input) => {
  rendered.push(input);
  return renderDocumentPdf(input);
};
```

Pass `renderPdf` to `handleApprove()`. Assert the specification renderer input
contains the owner exactly once. Unzip the new package and assert:

```ts
expect(strFromU8(zip["technical-specification.md"])).toContain(
  "**Prepared and claimed by:** Private Owner Sentinel",
);
expect(strFromU8(zip["technical-specification.md"]).match(
  /Prepared and claimed by/g,
)).toHaveLength(1);
```

Because the captured Markdown is passed unchanged to the real renderer, this
tests the application boundary without adding a second PDF text parser.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npx vitest run tests/documents/attribution.test.ts tests/api/generation.test.ts tests/api/revisions.test.ts tests/api/approval.test.ts
```

Expected: FAIL because the helper and approved attribution do not exist.

- [ ] **Step 4: Implement the deterministic helper**

Create:

```ts
const declaration =
  "The named person declares that they prepared and claim ownership of this documented idea.";

export function withOwnerDeclaration(
  markdown: string,
  ownerName: string,
): string {
  const name = ownerName.trim();
  if (!name) return markdown;
  const withoutExisting = markdown.replace(
    /\n+---\n+\*\*Prepared and claimed by:\*\*[\s\S]*$/u,
    "",
  );
  return `${withoutExisting.trimEnd()}

---

**Prepared and claimed by:** ${name}

${declaration}
`;
}
```

The API validation from Task 1 guarantees `ownerName` cannot inject Markdown.

- [ ] **Step 5: Apply attribution only at display and artifact boundaries**

On the server-rendered review page, map specification revisions before passing
them to `ReviewWorkspace`:

```ts
const displayedRevisions = project.revisions.map((revision) =>
  revision.documentType === "specification"
    ? {
        ...revision,
        content: withOwnerDeclaration(
          revision.content,
          project.ownerName,
        ),
      }
    : revision,
);
```

The revision API still reloads raw content from SQLite by revision ID, so the
owner name never enters a provider prompt. On the proof page, pass
`withOwnerDeclaration(revision.content, project.ownerName)` to
`DocumentPreview` only for the specification.

In approval packaging, compute:

```ts
const approvedSpecificationMarkdown = withOwnerDeclaration(
  specification.content,
  project.ownerName,
);
```

Use that exact value for specification PDF rendering, the stored approved
Markdown artifact, and the ZIP entry. Leave `revision.content` unchanged so
revision prompts never receive the owner name.

Add optional `renderPdf: typeof renderDocumentPdf` dependency injection to
`handleApprove()`, defaulting to `renderDocumentPdf`, and use it for both
document render calls. Production behavior remains unchanged while the test
can inspect the exact approved Markdown sent to the real renderer.

Increment `SPEC_PROMPT_VERSION` to `spec-v3` to identify the new rendered
technical-specification contract without adding `ownerName` to
`buildSpecificationPrompt()`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/documents/attribution.test.ts tests/api/generation.test.ts tests/api/revisions.test.ts tests/api/approval.test.ts
```

Expected: PASS; the owner sentinel is present only in local display/artifact
output.

- [ ] **Step 7: Commit**

```bash
git add server/documents/attribution.ts tests/documents/attribution.test.ts app/projects/[id]/review/page.tsx app/projects/[id]/proof/page.tsx app/api/projects/[id]/approve/route.ts server/generation/prompts.ts tests/api/generation.test.ts tests/api/revisions.test.ts tests/api/approval.test.ts
git commit -m "feat: bind owner declarations to specifications"
```

---

### Task 3: Rename the Sample NDA and Its Public Artifacts

**Files:**
- Modify: `server/generation/prompts.ts`
- Modify: `server/generation/schemas.ts`
- Modify: `server/generation/word-count.ts`
- Modify: `server/documents/package.ts`
- Modify: `server/documents/pdf.ts`
- Modify: `app/page.tsx`
- Modify: `components/generation-progress.tsx`
- Modify: `components/review-workspace.tsx`
- Modify: `app/projects/[id]/history/page.tsx`
- Modify: `app/projects/[id]/approve/page.tsx`
- Modify: `app/projects/[id]/proof/page.tsx`
- Modify: `app/api/projects/[id]/approve/route.ts`
- Modify: `README.md`
- Modify: `tests/generation/prompts.test.ts`
- Modify: `tests/generation/schemas.test.ts`
- Modify: `tests/generation/service.test.ts`
- Modify: `tests/documents/package.test.ts`
- Modify: `tests/documents/pdf.test.ts`
- Modify: `tests/ui/copy-contract.test.tsx`
- Modify: `tests/fixtures/openai-responses.ts`

**Interfaces:**
- Consumes: internal `documentType: "nda"` and `ManifestV1 | ManifestV2`.
- Produces: generated title `Sample Non-Disclosure Agreement` and new public filenames `sample-nda.md`, `sample-nda.pdf`, `sample-nda.pdf.ots`.

- [ ] **Step 1: Write failing generation and copy tests**

Assert:

```ts
expect(NDA_PROMPT_VERSION).toBe("nda-v3");
expect(buildNdaPrompt(validInput)).toContain("sample NDA template");
expect(toNdaMarkdown(validNda)).toMatch(
  /^# Sample Non-Disclosure Agreement/m,
);
```

Render the homepage, review workspace, history, approval, and proof surfaces.
Assert visible output contains `Sample NDA` and does not contain
`Mutual NDA` or `Mutual Non-Disclosure Agreement`.

- [ ] **Step 2: Write failing package and PDF tests**

Build a package and assert its exact keys are:

```ts
[
  "manifest.json",
  "sample-nda.md",
  "sample-nda.pdf",
  "sample-nda.pdf.ots",
  "technical-specification.md",
  "technical-specification.pdf",
  "technical-specification.pdf.ots",
]
```

Assert the manifest entries point to `sample-nda.*`, and the NDA PDF title is
`Sample Non-Disclosure Agreement`.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npx vitest run tests/generation/prompts.test.ts tests/generation/schemas.test.ts tests/generation/service.test.ts tests/documents/package.test.ts tests/documents/pdf.test.ts tests/ui/copy-contract.test.tsx
```

Expected: FAIL on the old title, prompt, labels, and package filenames.

- [ ] **Step 4: Update the generated contract and visible labels**

Set:

```ts
export const NDA_PROMPT_VERSION = "nda-v3";
```

Change `instructions("mutual NDA template", 700)` to
`instructions("sample NDA template", 700)`. Change the NDA schema title literal
and fixture title to `Sample Non-Disclosure Agreement`. Replace every
user-facing `Mutual NDA` label with `Sample NDA`; retain internal TypeScript
symbols such as `mutualNdaSchema` because they are not public contracts.

- [ ] **Step 5: Change new artifact filenames**

Replace the package public filenames with:

```ts
const publicFiles = [
  "technical-specification.md",
  "technical-specification.pdf",
  "technical-specification.pdf.ots",
  "sample-nda.md",
  "sample-nda.pdf",
  "sample-nda.pdf.ots",
] as const;
```

Update new approval stored paths, PDF paths, ZIP mappings, and Manifest V2
fields to use `sample-nda.*`. Existing approval rows retain their stored paths,
and existing ZIP files are never rewritten.

- [ ] **Step 6: Update current documentation**

Change README product copy and package listings to `Sample NDA` and
`sample-nda.*`. Do not rewrite historical design or plan documents; they remain
an audit trail of earlier decisions.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/generation/prompts.test.ts tests/generation/schemas.test.ts tests/generation/service.test.ts tests/documents/package.test.ts tests/documents/pdf.test.ts tests/ui/copy-contract.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/generation server/documents app components README.md tests/generation tests/documents tests/ui tests/fixtures/openai-responses.ts
git commit -m "feat: rename generated NDAs as samples"
```

---

### Task 4: Require the Ownership Confirmation at First Approval

**Files:**
- Modify: `components/approval-button.tsx`
- Modify: `app/projects/[id]/approve/page.tsx`
- Modify: `app/api/projects/[id]/approve/route.ts`
- Modify: `app/terms/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/api/approval.test.ts`
- Modify: `tests/ui/copy-contract.test.tsx`

**Interfaces:**
- Consumes: existing approval revision IDs and `Project.ownerName`.
- Produces: optional request field `ownershipConfirmed?: boolean`; first approvals with a non-empty owner name require literal `true`, while legacy projects and retries ignore it.

- [ ] **Step 1: Write failing approval API tests**

For a new review project with an owner name, submit valid revision IDs without confirmation and
assert:

```ts
expect(response.status).toBe(400);
expect(await response.json()).toMatchObject({
  code: "OWNERSHIP_CONFIRMATION_REQUIRED",
});
```

Submit the same request with `ownershipConfirmed: true` and assert `201`.
Create a legacy project with `ownerName: ""` and assert its first approval does
not require confirmation. Create a failed approved project, retry without
`ownershipConfirmed`, and assert the retry still reaches timestamping.

- [ ] **Step 2: Write failing UI and Terms tests**

Render `ApprovalButton` and assert it contains the exact unchecked checkbox
label. Assert the approval button is initially disabled. Render Terms and
assert the approved text appears:

```text
A confirmed OpenTimestamps proof shows that an exact approved PDF existed by a certain time.
```

```text
The technical-specification PDF includes its prepared-and-claimed-by declaration.
```

```text
The timestamp does not independently verify the declarant’s identity or resolve competing ownership claims.
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npx vitest run tests/api/approval.test.ts tests/ui/copy-contract.test.tsx
```

Expected: FAIL because confirmation is neither collected nor enforced.

- [ ] **Step 4: Enforce confirmation server-side**

Extend `approvalInput`:

```ts
const approvalInput = z
  .object({
    specificationRevisionId: z.uuid(),
    ndaRevisionId: z.uuid(),
    ownershipConfirmed: z.boolean().optional(),
  })
  .strict();
```

After loading the project and before creating a new approval:

```ts
if (
  !project.approval &&
  project.ownerName &&
  input.ownershipConfirmed !== true
) {
  throw new AppError(
    "OWNERSHIP_CONFIRMATION_REQUIRED",
    "Confirm the prepared-and-claimed-by declaration before approval.",
    400,
  );
}
```

Keep this check after the existing-approval retry branch is identified so
retries remain possible without repeating the checkbox.

- [ ] **Step 5: Add the accessible approval checkbox**

Pass `requiresOwnershipConfirmation={Boolean(project.ownerName)}` to
`ApprovalButton`. Track `ownershipConfirmed` in the component and render the
following only when that prop is true:

```tsx
<label className="ownership-confirmation">
  <input
    type="checkbox"
    checked={ownershipConfirmed}
    onChange={(event) => setOwnershipConfirmed(event.target.checked)}
  />
  <span>
    I confirm that I prepared and claim ownership of this documented idea.
  </span>
</label>
```

Send `ownershipConfirmed` in the approval JSON body and disable the approval
button while `(requiresOwnershipConfirmation && !ownershipConfirmed)` or
submitting. Show the project owner in the approval summary as
`Prepared and claimed by: {project.ownerName}` for new projects; omit the row
and confirmation for legacy empty names.

- [ ] **Step 6: Update Terms and minimal responsive styles**

Replace the current timestamp paragraph with the approved four-sentence copy
from the design spec. Style the checkbox as a normal flex row with a native
16-pixel checkbox, visible focus, wrapping label text, and no custom control.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/api/approval.test.ts tests/ui/copy-contract.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/approval-button.tsx app/projects/[id]/approve/page.tsx app/api/projects/[id]/approve/route.ts app/terms/page.tsx app/globals.css tests/api/approval.test.ts tests/ui/copy-contract.test.tsx
git commit -m "feat: confirm ownership claims before proof"
```

---

### Task 5: Update Browser Journeys, Screenshots, and Release Documentation

**Files:**
- Modify: `tests/e2e/ideaproof.spec.ts`
- Modify: `tests/e2e/screenshots.spec.ts`
- Modify: `docs/images/ideaproof-review.png`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: the complete owner declaration, Sample NDA, approval, and package behavior from Tasks 1–4.
- Produces: deterministic OpenAI and Claude journeys proving the final user contract.

- [ ] **Step 1: Update the E2E journey before production selectors**

For both provider cases, fill:

```ts
await page.getByLabel("Owner’s full name").fill("Ada Lovelace");
```

Use `Sample NDA` for the review tab. On approval, assert the owner name is
visible, confirm the checkbox, then approve. Assert downloaded keys include
`sample-nda.*`, the attributed specification Markdown contains Ada once, and
the manifest points to the new filenames.

- [ ] **Step 2: Update screenshot expectations**

Fill the deterministic owner name `Ada Lovelace`, expect the `Sample NDA` tab,
and capture the review screenshot after the attributed footer is visible.
Confirm the approval checkbox before continuing to the proof screenshot.

- [ ] **Step 3: Run browser tests and regenerate screenshots**

Run:

```bash
npx playwright test tests/e2e/ideaproof.spec.ts tests/e2e/screenshots.spec.ts
```

Expected: PASS for OpenAI, Claude, desktop screenshots, mobile overflow,
reduced motion, and the 200%-zoom equivalent.

- [ ] **Step 4: Inspect public images**

Open `docs/images/ideaproof-review.png` and confirm:

- `Sample NDA` is the visible tab label;
- the owner declaration appears once;
- no API key, private fixture, clipping, or mockup runtime text appears.

- [ ] **Step 5: Finish README and contributor guidance**

Document the required owner name, local-only handling, exact PDF attribution,
affirmative ownership claim, limits of timestamp evidence, new filenames, and
the fact that existing packages remain valid. Add contributor guidance that
owner names must never enter provider prompts or test screenshots except the
public deterministic fixture name.

- [ ] **Step 6: Run the complete release gate**

Run:

```bash
npm run verify
npm run test:e2e
OPENAI_API_KEY=smoke-fixture-key IDEAPROOF_DATA_DIR=/tmp/ideaproof-owner-smoke IDEAPROOF_SMOKE_PORT=3101 npm run smoke
npm audit --omit=dev
git diff --check
```

Expected: 0 failures, HTTP 200 for home and setup, 0 known production
vulnerabilities, and no whitespace errors.

- [ ] **Step 7: Run privacy and compatibility audits**

Run:

```bash
rg -n 'Private Owner Sentinel' app components server README.md
rg -n -i 'mutual nda|mutual non-disclosure' app components server README.md
git ls-files | rg '(^|/)(data|\.env|\.venv|test-results|playwright-report)(/|$)'
```

Expected: no production sentinel, no current user-facing old terminology, and
no tracked runtime data. Historical specs/plans and internal symbol names are
excluded from the terminology audit.

- [ ] **Step 8: Request final code review**

Use `superpowers:requesting-code-review` over the implementation commit range.
Resolve every Critical or Important correctness, privacy, compatibility,
accessibility, or evidence-claim finding, then rerun the smallest affected
tests followed by `npm run verify` and `npm run test:e2e`.

- [ ] **Step 9: Commit**

```bash
git add tests/e2e docs/images README.md CONTRIBUTING.md
git commit -m "docs: explain timestamped owner declarations"
```

- [ ] **Step 10: Preserve the review branch**

Run:

```bash
git status --short
git log -12 --oneline
```

Expected: clean `feat/ideaproof-build`. Do not merge or push without explicit
user authorization.
