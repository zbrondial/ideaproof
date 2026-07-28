# Idea History and Regeneration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canonical Idea name, append-only idea snapshots, pre-approval editing, and explicit two-document regeneration tied to the latest idea version.

**Architecture:** Keep `projects.title` and `projects.idea` as the latest values, add immutable `idea_versions` snapshots, and link every generated revision to its source snapshot. The Review page owns editing and explicit regeneration; the approval boundary rejects revisions based on older idea snapshots. Existing approved proofs remain untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Node SQLite, Zod 4, OpenAI/Anthropic SDKs, Vitest 4, Playwright 1.62.

## Global Constraints

- Field label: **Idea name**.
- Help text: “Use a short working name.”
- Idea name length: 1–120 trimmed characters.
- Saving an idea update makes zero AI requests.
- Button copy: **Regenerate both documents · 2 AI requests**.
- Normal regeneration uses one provider request per document; a document may use one additional shortening request only when over its word ceiling.
- Idea-history times are local records, not OpenTimestamps proofs.
- Idea edits are rejected after approval.
- Approval is unavailable until both selected documents use the latest idea snapshot.
- Correct only the current local project label to `ray`; never alter approved PDFs, fingerprints, `.ots` files, or approval time.
- Add no dependencies.

---

## File map

- `server/db/migrations/004-idea-history.sql`: idea snapshots and revision linkage.
- `server/db/projects.ts`: idea-version types, transactional create/update/history methods, and stale-revision checks.
- `app/api/projects/route.ts`: required Idea name on creation.
- `app/api/projects/[id]/idea/route.ts`: pre-approval idea update endpoint.
- `server/generation/prompts.ts`: explicit Idea name facts and prompt version bump.
- `server/generation/service.ts`: pass Idea name to both document prompt builders.
- `app/api/projects/[id]/generate/[documentType]/route.ts`: link output to the current idea snapshot.
- `app/api/projects/[id]/revisions/route.ts`: link feedback revisions to the current idea snapshot.
- `app/api/projects/[id]/approve/route.ts`: stale-document rejection.
- `components/project-form.tsx`: required Idea name field and payload.
- `components/idea-editor.tsx`: save append-only idea updates.
- `components/generation-progress.tsx`: explicit two-request regeneration mode.
- `components/review-workspace.tsx`: stale selection handling and approval gating.
- `app/projects/[id]/review/page.tsx`: editor, Project history link, and regeneration state.
- `app/projects/[id]/history/page.tsx`: idea snapshots plus document revisions.
- `app/globals.css`: compact editor/history/stale-state styling.
- `tests/db/projects.test.ts`: migration, snapshot, locking, and stale revision tests.
- `tests/api/generation-harness.ts`: Idea name and source-version fixtures.
- `tests/api/generation.test.ts`: generation source linkage.
- `tests/api/revisions.test.ts`: feedback revision source linkage.
- `tests/api/approval.test.ts`: stale approval rejection.
- `tests/generation/prompts.test.ts`: Idea name prompt facts.
- `tests/ui/copy-contract.test.tsx`: field/editor/button copy.
- `tests/e2e/ideaproof.spec.ts`: full edit/history/regenerate/approve flow.

### Task 1: Add append-only idea-version storage

**Files:**
- Create: `server/db/migrations/004-idea-history.sql`
- Modify: `server/db/projects.ts`
- Modify: `tests/db/projects.test.ts`
- Modify: `tests/api/generation-harness.ts`

**Interfaces:**
- Produces:

```ts
type IdeaVersion = {
  id: string;
  projectId: string;
  version: number;
  ideaName: string;
  idea: string;
  updateNote: string | null;
  createdAt: string;
};

type Project = {
  currentIdeaVersionId: string;
  // existing fields unchanged
};

type Revision = {
  ideaVersionId: string;
  // existing fields unchanged
};
```

- Store additions:

```ts
getIdeaVersions(projectId: string): IdeaVersion[];
updateIdea(id: string, input: {
  ideaName: string;
  idea: string;
  updateNote?: string;
}): ProjectDetail;
selectedDocumentsUseCurrentIdea(projectId: string): boolean;
```

- [ ] **Step 1: Add failing store and migration tests**

Extend `projectInput` with:

```ts
ideaName: "IdeaProof",
```

Add tests proving:

```ts
const project = store.createProject(projectInput);
expect(project.title).toBe("IdeaProof");
expect(store.getIdeaVersions(project.id)).toEqual([
  expect.objectContaining({
    version: 1,
    ideaName: "IdeaProof",
    idea: projectInput.idea,
    updateNote: null,
  }),
]);

const updated = store.updateIdea(project.id, {
  ideaName: "IdeaProof Next",
  idea: "A more detailed local proof tool for early software ideas.",
  updateNote: "Expanded the target workflow.",
});
expect(updated).toMatchObject({
  title: "IdeaProof Next",
  idea: "A more detailed local proof tool for early software ideas.",
});
expect(store.getIdeaVersions(project.id).map((item) => item.version)).toEqual([
  1, 2,
]);
```

Add an approval-lock assertion:

```ts
expect(() =>
  store.updateIdea(approvedProject.id, {
    ideaName: "Changed",
    idea: "Changed after approval",
  }),
).toThrowError(expect.objectContaining({ code: "PROJECT_IMMUTABLE" }));
```

Extend the existing legacy migration test to assert one backfilled snapshot and non-null `ideaVersionId` on the legacy revision.

- [ ] **Step 2: Run the store tests and confirm RED**

```bash
npm test -- tests/db/projects.test.ts
```

Expected: missing `ideaName`, `getIdeaVersions`, `updateIdea`, and idea-version fields.

- [ ] **Step 3: Create migration 004**

Use:

```sql
CREATE TABLE idea_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  idea_name TEXT NOT NULL,
  idea TEXT NOT NULL,
  update_note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, version)
);

CREATE INDEX idea_versions_project_created_at
  ON idea_versions(project_id, created_at DESC);

ALTER TABLE projects
  ADD COLUMN current_idea_version_id TEXT REFERENCES idea_versions(id);

ALTER TABLE revisions
  ADD COLUMN idea_version_id TEXT REFERENCES idea_versions(id);

INSERT INTO idea_versions
  (id, project_id, version, idea_name, idea, update_note, created_at)
SELECT id, id, 1, title, idea, NULL, created_at
FROM projects;

UPDATE projects
SET current_idea_version_id = id;

UPDATE revisions
SET idea_version_id = project_id;
```

The backfill intentionally reuses the project UUID as the first snapshot UUID.

- [ ] **Step 4: Implement types, row mapping, and transactional creation**

Add `IdeaVersionRow`, `ideaVersionFromRow`, and the public types. Change `createProject` to require `ideaName` and wrap insertion in `inTransaction`:

```ts
createProject(input: {
  ideaName: string;
  ownerName?: string;
  idea: string;
  technologyPreference?: string;
  ndaPurpose: string;
  ndaDetails?: string;
  provider: AiProvider;
  model: string;
}): Project {
  return inTransaction(database, () => {
    const projectId = randomUUID();
    const ideaVersionId = randomUUID();
    const now = new Date().toISOString();
    const ideaName = input.ideaName.trim();
    if (!ideaName || ideaName.length > 120) {
      throw new AppError(
        "PROJECT_IDEA_NAME_INVALID",
        "Add an Idea name within 120 characters.",
        400,
      );
    }
    database
      .prepare(
        `INSERT INTO projects
          (id, title, owner_name, idea, technology_preference, nda_purpose,
           nda_details, provider, model, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      )
      .run(
        projectId,
        ideaName,
        input.ownerName ?? "",
        input.idea,
        input.technologyPreference ?? "",
        input.ndaPurpose,
        input.ndaDetails ?? "",
        input.provider,
        input.model,
        now,
        now,
      );
    database
      .prepare(
        `INSERT INTO idea_versions
          (id, project_id, version, idea_name, idea, update_note, created_at)
         VALUES (?, ?, 1, ?, ?, NULL, ?)`,
      )
      .run(ideaVersionId, projectId, ideaName, input.idea, now);
    database
      .prepare(
        "UPDATE projects SET current_idea_version_id = ? WHERE id = ?",
      )
      .run(ideaVersionId, projectId);
    return projectFromRow(getProjectRow(projectId));
  });
}
```

Implement `getIdeaVersions` with `ORDER BY version`.

- [ ] **Step 5: Implement transactional updates and stale detection**

`updateIdea` must:

1. reject projects with an approval;
2. trim and validate non-empty Idea name and idea;
3. insert the next full snapshot;
4. update `projects.title`, `projects.idea`, `current_idea_version_id`, and `updated_at`;
5. return `getProject(id)`.

Implement:

```ts
selectedDocumentsUseCurrentIdea(projectId: string) {
  const project = getProjectRow(projectId);
  if (
    !project.selected_specification_revision_id ||
    !project.selected_nda_revision_id
  ) return false;
  const specification = getRevisionRow(
    project.selected_specification_revision_id,
  );
  const nda = getRevisionRow(project.selected_nda_revision_id);
  return (
    specification.idea_version_id === project.current_idea_version_id &&
    nda.idea_version_id === project.current_idea_version_id
  );
}
```

Require `ideaVersionId` in `addRevision` and persist it.

- [ ] **Step 6: Update all test project and revision fixtures**

Add `ideaName` to every `createProject` fixture and use:

```ts
ideaVersionId: store.getProject(project.id).currentIdeaVersionId,
```

for every direct `addRevision` call.

- [ ] **Step 7: Run tests and confirm GREEN**

```bash
npm test -- tests/db/projects.test.ts tests/api/generation.test.ts tests/api/revisions.test.ts tests/api/approval.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/db/migrations/004-idea-history.sql server/db/projects.ts tests
git commit -m "feat: preserve append-only idea history"
```

### Task 2: Require Idea name and send it to both AI prompts

**Files:**
- Modify: `app/api/projects/route.ts`
- Modify: `components/project-form.tsx`
- Modify: `server/generation/prompts.ts`
- Modify: `server/generation/service.ts`
- Modify: `app/api/projects/[id]/generate/[documentType]/route.ts`
- Modify: `app/api/projects/[id]/revisions/route.ts`
- Modify: `tests/config.test.ts`
- Modify: `tests/generation/prompts.test.ts`
- Modify: `tests/api/generation.test.ts`
- Modify: `tests/api/revisions.test.ts`
- Modify: `tests/ui/copy-contract.test.tsx`
- Modify: `tests/e2e/ideaproof.spec.ts`

**Interfaces:**
- Project creation JSON gains `ideaName: string`.
- `GenerationInput` gains `ideaName: string`.
- New prompt versions: `spec-v5` and `nda-v5`.

- [ ] **Step 1: Add failing API, prompt, and UI assertions**

Creation validation:

```ts
expect(
  await POST(
    requestWithBody({
      ideaName: "",
      ownerName: "Ada Lovelace",
      idea: validIdea,
      ndaPurpose: validPurpose,
      provider: "openai",
      model: "gpt-5.6",
    }),
  ),
).toMatchObject({ status: 400 });
```

Prompt assertions:

```ts
const prompt = buildSpecificationPrompt({
  ideaName: "Ray",
  idea: "An AI assistant.",
  technologyPreference: "",
});
expect(prompt).toContain('"ideaName": "Ray"');
expect(prompt).toContain("Use the supplied Idea name exactly as the title");
expect({ SPEC_PROMPT_VERSION, NDA_PROMPT_VERSION }).toEqual({
  SPEC_PROMPT_VERSION: "spec-v5",
  NDA_PROMPT_VERSION: "nda-v5",
});
```

UI assertion:

```ts
expect(both).toContain('<label for="ideaName">Idea name</label>');
expect(both).toContain("Use a short working name.");
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
npm test -- tests/generation/prompts.test.ts tests/ui/copy-contract.test.tsx tests/api/generation.test.ts
```

Expected: Idea name is absent from schemas, prompts, and form.

- [ ] **Step 3: Implement creation validation and form payload**

Add:

```ts
ideaName: z.string().trim().min(1).max(120),
```

to `projectInputSchema`. Add this field above Owner’s full name:

```tsx
<div className="field">
  <label htmlFor="ideaName">Idea name</label>
  <input
    id="ideaName"
    name="ideaName"
    required
    minLength={1}
    maxLength={120}
    aria-describedby="idea-name-help"
    placeholder="For example: IdeaProof"
  />
  <p className="field-help" id="idea-name-help">
    Use a short working name.
  </p>
</div>
```

Include `ideaName: form.get("ideaName")` in the POST body.

- [ ] **Step 4: Implement prompt propagation**

Add `ideaName` to both prompt-builder inputs and USER FACTS. Add:

```txt
Use the supplied Idea name exactly as the title and product reference.
```

to the specification prompt and:

```txt
Use the supplied Idea name exactly when referring to the disclosed idea.
```

to the NDA prompt. Bump both prompt versions to v5.

Pass `project.title` as `ideaName` from generation and revision routes.

- [ ] **Step 5: Link every generated revision to the current idea snapshot**

In both generation routes, pass:

```ts
ideaVersionId: project.currentIdeaVersionId,
```

to `store.addRevision`.

- [ ] **Step 6: Update the E2E creation flow**

Before Owner’s full name, fill:

```ts
await page.getByLabel("Idea name").fill("IdeaProof");
```

Assert Proof Logs and project headings use exactly `IdeaProof`.

- [ ] **Step 7: Run focused and full unit tests**

```bash
npm test -- tests/generation/prompts.test.ts tests/api/generation.test.ts tests/api/revisions.test.ts tests/ui/copy-contract.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/api/projects/route.ts components/project-form.tsx server/generation app/api/projects tests
git commit -m "feat: use a canonical Idea name"
```

### Task 3: Add the pre-approval idea editor and Project history

**Files:**
- Create: `app/api/projects/[id]/idea/route.ts`
- Create: `components/idea-editor.tsx`
- Modify: `app/projects/[id]/review/page.tsx`
- Modify: `app/projects/[id]/history/page.tsx`
- Modify: `app/globals.css`
- Create: `tests/api/idea.test.ts`
- Modify: `tests/ui/copy-contract.test.tsx`
- Modify: `tests/e2e/ideaproof.spec.ts`

**Interfaces:**
- `POST /api/projects/:id/idea` body:

```ts
{
  ideaName: string;
  idea: string;
  updateNote?: string;
}
```

- Success:

```ts
{
  ideaVersionId: string;
  version: number;
  ideaName: string;
  updatedAt: string;
}
```

- [ ] **Step 1: Write failing API tests**

Cover successful append, invalid fields, and approval lock:

```ts
const response = await handleIdeaUpdate({
  projectId: project.id,
  body: {
    ideaName: "Ray",
    idea: "A more detailed AI assistant concept.",
    updateNote: "Clarified the product direction.",
  },
  store,
});
expect(response.status).toBe(200);
expect(store.getIdeaVersions(project.id)).toHaveLength(2);
```

Expected approved response: HTTP 409 with `PROJECT_IMMUTABLE`.

- [ ] **Step 2: Run API tests and confirm RED**

```bash
npm test -- tests/api/idea.test.ts
```

Expected: route and handler do not exist.

- [ ] **Step 3: Implement the route**

Use a strict Zod schema:

```ts
const inputSchema = z.object({
  ideaName: z.string().trim().min(1).max(120),
  idea: z.string().trim().min(20).max(10_000),
  updateNote: z.string().trim().max(500).optional().default(""),
}).strict();
```

Call `store.updateIdea`, return the newest snapshot, and map `AppError` to its safe status/message.

- [ ] **Step 4: Add failing UI copy and browser checks**

Assert the Review page exposes:

- **Edit idea details**
- **Idea name**
- **Raw software idea**
- **Update note** / **Optional**
- **Save idea update**
- **Project history**

After saving an update, assert the history page shows `Idea created`, `Idea updated`, both dates, the update note, and full snapshots.

- [ ] **Step 5: Implement `IdeaEditor`**

The component receives `projectId`, `ideaName`, and `idea`. On submit:

```tsx
const response = await fetch(`/api/projects/${projectId}/idea`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ideaName, idea, updateNote }),
});
```

Show `Saving…`, then “Idea update saved locally. Regenerate both documents before approval.” and call `router.refresh()`.

- [ ] **Step 6: Expand the history page**

Rename the page heading and Review link to **Project history**. Render two sections:

```tsx
<section>
  <h2>Idea history</h2>
  {ideaVersions.toReversed().map((version) => (
    <details key={version.id}>
      <summary>
        <span>{version.version === 1 ? "Idea created" : "Idea updated"}</span>
        <time dateTime={version.createdAt}>
          {new Date(version.createdAt).toLocaleString()}
        </time>
      </summary>
      <h3>{version.ideaName}</h3>
      <p>{version.idea}</p>
      {version.updateNote ? <p>Update note: {version.updateNote}</p> : null}
    </details>
  ))}
</section>
<section>
  <h2>Document history</h2>
  <div className="history-list">
    {revisions.map((revision) => (
      <details key={revision.id}>
        <summary>
          <span>
            {revision.documentType === "nda"
              ? "Sample NDA"
              : "Specification"}{" "}
            · Version {revision.version}
          </span>
          <span>{revision.wordCount} words</span>
        </summary>
        <dl className="revision-meta">
          <div>
            <dt>Created</dt>
            <dd>{new Date(revision.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Provider and model</dt>
            <dd>
              {revision.provider === "openai" ? "OpenAI" : "Claude"} ·{" "}
              {revision.model}
            </dd>
          </div>
          <div>
            <dt>Prompt</dt>
            <dd>{revision.promptTemplateVersion}</dd>
          </div>
          <div>
            <dt>Feedback</dt>
            <dd>{revision.feedback ?? "Initial generation"}</dd>
          </div>
        </dl>
        <DocumentPreview
          markdown={
            revision.documentType === "specification"
              ? withOwnerDeclaration(revision.content, project.ownerName)
              : revision.content
          }
        />
      </details>
    ))}
  </div>
</section>
```

- [ ] **Step 7: Run focused checks**

```bash
npm test -- tests/api/idea.test.ts tests/ui/copy-contract.test.tsx
npx playwright test tests/e2e/ideaproof.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/api/projects/[id]/idea components/idea-editor.tsx app/projects/[id]/review/page.tsx app/projects/[id]/history/page.tsx app/globals.css tests
git commit -m "feat: add editable idea history"
```

### Task 4: Add explicit two-document regeneration and approval gating

**Files:**
- Modify: `components/generation-progress.tsx`
- Modify: `components/review-workspace.tsx`
- Modify: `app/projects/[id]/review/page.tsx`
- Modify: `app/projects/[id]/approve/page.tsx`
- Modify: `app/api/projects/[id]/approve/route.ts`
- Modify: `tests/api/approval.test.ts`
- Modify: `tests/api/generation.test.ts`
- Modify: `tests/ui/copy-contract.test.tsx`
- Modify: `tests/e2e/ideaproof.spec.ts`

**Interfaces:**
- `GenerationProgress` gains:

```ts
{
  autoStart?: boolean;
  onComplete?: "review" | "refresh";
}
```

- `ReviewWorkspace` gains `currentIdeaVersionId: string`.

- [ ] **Step 1: Add failing stale-approval API tests**

Create two selected revisions for idea snapshot 1, append snapshot 2, then approve:

```ts
expect(response.status).toBe(409);
await expect(response.json()).resolves.toMatchObject({
  code: "DOCUMENTS_OUTDATED",
  message:
    "Regenerate both documents from the latest idea update before approval.",
});
```

Add a passing case where both selected revisions use snapshot 2.

- [ ] **Step 2: Add failing Review UI tests**

Assert stale projects show:

```txt
Your idea changed after these documents were generated.
Regenerate both documents · 2 AI requests
```

and do not expose an active **Approve selected revisions** link. Assert current documents retain the active link.

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
npm test -- tests/api/approval.test.ts tests/ui/copy-contract.test.tsx
```

Expected: stale approvals are accepted and no regeneration action exists.

- [ ] **Step 4: Enforce the server boundary**

Before rendering PDFs in `handleApprove`:

```ts
if (!store.selectedDocumentsUseCurrentIdea(projectId)) {
  throw new AppError(
    "DOCUMENTS_OUTDATED",
    "Regenerate both documents from the latest idea update before approval.",
    409,
  );
}
```

In `ApprovePage`, redirect stale selections back to Review or show the same notice with a **Return to review** link.

- [ ] **Step 5: Generalize generation progress minimally**

Add defaults:

```ts
autoStart = true,
onComplete = "review",
```

When `autoStart` is false, render the button before starting. On complete:

```ts
if (onComplete === "refresh") {
  router.refresh();
} else {
  router.replace(`/projects/${projectId}/review`);
}
```

The explicit button label must be exactly:

```tsx
Regenerate both documents · 2 AI requests
```

Retain the existing per-document retry behavior so a successful sibling revision is not discarded.

- [ ] **Step 6: Gate approval based on selected revisions**

In `ReviewWorkspace`, resolve selected spec and NDA and compute:

```ts
const selectedDocumentsAreCurrent =
  selectedSpecification?.ideaVersionId === currentIdeaVersionId &&
  selectedNda?.ideaVersionId === currentIdeaVersionId;
```

Render the approval link only when true. Otherwise render the stale notice.

On the Review page, mount explicit `GenerationProgress` when the store says current selected documents are stale:

```tsx
<GenerationProgress
  projectId={project.id}
  provider={project.provider}
  model={project.model}
  autoStart={false}
  onComplete="refresh"
/>
```

- [ ] **Step 7: Extend the E2E flow**

After initial generation:

1. save a new Idea name and expanded description;
2. verify Project history contains both snapshots;
3. verify approval is unavailable;
4. click **Regenerate both documents · 2 AI requests**;
5. verify two new selected document versions;
6. verify approval becomes available;
7. finish approval and proof verification.

- [ ] **Step 8: Run focused checks**

```bash
npm test -- tests/api/approval.test.ts tests/api/generation.test.ts tests/ui/copy-contract.test.tsx
npx playwright test tests/e2e/ideaproof.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/generation-progress.tsx components/review-workspace.tsx app/projects/[id] app/api/projects/[id]/approve tests
git commit -m "feat: regenerate documents from idea updates"
```

### Task 5: Correct the current local project label without changing proof artifacts

**Files:**
- Modify local runtime data only: `data/ideaproof.sqlite`

**Interfaces:**
- Consumes: migration 004 and the existing project `e3b38d88-24f0-425a-bac7-f31ceb428926`.
- Produces: local title `ray` plus an append-only correction snapshot.

- [ ] **Step 1: Resolve and record immutable proof values**

Run a read-only query:

```bash
sqlite3 -header -column data/ideaproof.sqlite "
SELECT p.id, p.title, a.approved_at, pa.document_type, pa.sha256, pa.ots_path
FROM projects p
JOIN approvals a ON a.project_id = p.id
JOIN proof_artifacts pa ON pa.approval_id = a.id
WHERE p.id = 'e3b38d88-24f0-425a-bac7-f31ceb428926'
ORDER BY pa.document_type;
"
```

Save the output in the task notes for before/after comparison.

- [ ] **Step 2: Make a recoverable database backup**

Stop IdeaProof, then:

```bash
cp data/ideaproof.sqlite /tmp/ideaproof-before-ray-title.sqlite
```

- [ ] **Step 3: Append the correction transaction**

Execute one transaction:

```sql
BEGIN IMMEDIATE;
INSERT INTO idea_versions
  (id, project_id, version, idea_name, idea, update_note, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  (SELECT COALESCE(MAX(version), 0) + 1
   FROM idea_versions
   WHERE project_id = projects.id),
  'ray',
  idea,
  'Idea name aligned with the approved technical specification and Sample NDA.',
  datetime('now')
FROM projects
WHERE id = 'e3b38d88-24f0-425a-bac7-f31ceb428926';

UPDATE projects
SET title = 'ray',
    current_idea_version_id = (
      SELECT id
      FROM idea_versions
      WHERE project_id = projects.id
      ORDER BY version DESC
      LIMIT 1
    ),
    updated_at = datetime('now')
WHERE id = 'e3b38d88-24f0-425a-bac7-f31ceb428926';
COMMIT;
```

- [ ] **Step 4: Verify the label and proof invariants**

Repeat Step 1 and confirm:

- title is `ray`;
- `approved_at`, both SHA-256 values, and both `.ots` paths exactly match the before query;
- the newest idea snapshot is `ray`;
- approved PDFs remain byte-for-byte unchanged using their stored SHA-256 values.

- [ ] **Step 5: Restart the app**

```bash
npm start -- --port 3001
```

Open Proof Logs and the proof page; both must show `ray`.

Do not commit `data/ideaproof.sqlite`; it remains ignored local user data.

### Task 6: Full verification, documentation, and screenshots

**Files:**
- Modify: `README.md`
- Modify: `docs/images/ideaproof-home.png`
- Modify: `docs/images/ideaproof-review.png`

**Interfaces:**
- Consumes: completed Tasks 1–5 plus the compact-proof-page plan.
- Produces: verified user documentation and visual artifacts.

- [ ] **Step 1: Update README behavior**

Document:

- required Idea name;
- append-only local Idea history;
- local history dates are not OpenTimestamps proofs;
- saving idea edits makes no AI request;
- regenerating both documents normally makes two AI requests;
- approval requires current documents.

- [ ] **Step 2: Run the complete verification gate**

```bash
npm run verify
```

Expected: lint, TypeScript, all unit/API tests, and production build pass.

- [ ] **Step 3: Run the complete browser suite**

```bash
npm run test:e2e
```

Expected: OpenAI and Claude flows, idea edit/history, two-request regeneration, approval, proof confirmation, download, independent verification, responsive navigation, and screenshots pass.

- [ ] **Step 4: Restore generated Next metadata if needed**

Keep `next-env.d.ts` at:

```ts
import "./.next/types/routes.d.ts";
```

- [ ] **Step 5: Inspect visuals and repository state**

```bash
git status --short
git diff --check
```

Visually inspect both README screenshots and the live Proof Logs, Review, Project history, and Proof pages at desktop and mobile widths.

- [ ] **Step 6: Commit documentation and generated artifacts**

```bash
git add README.md docs/images/ideaproof-home.png docs/images/ideaproof-review.png
git commit -m "docs: explain Idea history and regeneration"
```

- [ ] **Step 7: Push and restart the review server**

```bash
git push origin feat/ideaproof-build
npm start -- --port 3001
```

Confirm HTTP 200 and leave the server running for user review.
