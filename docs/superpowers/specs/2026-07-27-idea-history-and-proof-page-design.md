# Idea History and Compact Proof Page Design

## Goal

Give every project a short, user-controlled Idea name, preserve an append-only
trail from idea inception through later edits, and make the completed proof
page easier to scan. The change does not alter how approved PDFs are
fingerprinted or verified.

## Idea name

- Add a required **Idea name** field above **Owner’s full name** on the new
  project form.
- Use the help text: “Use a short working name.”
- Accept 1–120 characters after trimming.
- Store the value in the existing project title field. Stop deriving new
  project titles from the first 80 characters of the idea description.
- Use the Idea name in Proof Logs, project headings, AI prompt facts, generated
  document titles, and proof-package filenames.
- Allow the Idea name and raw idea description to be edited from the Review
  page while the project is unapproved.
- Lock idea editing after approval, matching the existing document lock.

## Idea history

- Preserve complete snapshots instead of overwriting the previous idea.
- The first snapshot is labeled **Idea created** and records the Idea name,
  complete raw idea description, and local creation date and time.
- Each later save is labeled **Idea updated** and records the complete new Idea
  name, complete raw idea description, local date and time, and an optional
  update note.
- Show the snapshots newest-first in a **Project history** page. Each entry is
  independently expandable and readable.
- The same page also retains the existing generated-document revision history,
  including provider, model, prompt version, feedback, and full document
  content.
- Link to **Project history** from both Review and Proof pages. On the Proof
  page, this replaces the removed contextual **Verify proof** link without
  adding a new row.

Idea-history dates are local activity records. They are not externally
verifiable OpenTimestamps proofs. Only the approved PDFs and their matching
`.ots` files carry the existing timestamp proof.

## Editing and regeneration flow

1. The user edits the Idea name and/or raw idea description on the Review page
   and may add an update note.
2. **Save idea update** writes a new local snapshot and updates the current
   project fields. It makes no AI request.
3. The page marks the selected documents as based on an earlier idea snapshot
   and shows **Regenerate both documents · 2 AI requests**.
4. Regeneration makes one provider request for the technical specification and
   one for the Sample NDA. Each document may make one additional shortening
   request only if it exceeds its word ceiling.
5. Each successfully generated document becomes a new selected revision linked
   to the latest idea snapshot. If one request fails, its successful sibling
   remains saved and the UI offers retry for only the failed document.
6. Approval stays unavailable until both selected documents are linked to the
   latest idea snapshot.

Document-specific feedback continues to regenerate only the selected document
with one normal provider request. It does not edit the Idea name or raw idea
history.

## Proof page

- Remove the decorative **Proof record** label.
- Display the short Idea name as the page title.
- Render the timestamp explanation as two separate sentence lines:

  1. “IdeaProof created a digital fingerprint of each approved PDF on
     `<local approval date and time>`.”
  2. “OpenTimestamps confirmation may take time, so check again later if it is
     still pending.”

- Remove the **Verify proof** button beside **Download proof package**.
- Remove the **Verify proof** link above the approved document previews.
- Rename **Exact revisions in this proof** to **Timestamped documents**.
- Keep **Timestamped documents** on one line at desktop widths. Normal
  responsive wrapping remains allowed on narrow mobile screens to avoid
  horizontal overflow.
- Put the **Project history** link on the same heading row as **Timestamped
  documents**.
- When **Check confirmation** is clicked, immediately show this progress
  message below the action:
  “Checking whether OpenTimestamps has confirmed the digital fingerprints of
  both PDFs…”
- Replace that progress message with the confirmed, pending, or error result
  when the background request finishes. Announce both progress and results
  through the existing polite status region for screen-reader users.
- Keep the global navigation’s **Verify proof** entry. The requested removals
  apply only to the two contextual proof-page links.
- Continue showing only the approved technical-specification and Sample NDA
  versions on the proof page. Earlier versions remain available in Project
  history and are not part of the timestamped proof.

## Data model

- Keep the current project title and raw idea columns as the latest snapshot
  for efficient listing and generation.
- Add an append-only `idea_versions` table containing the snapshot identifier,
  project identifier, sequential version, Idea name, raw idea description,
  optional update note, and creation timestamp.
- Record the source idea-version identifier on each new generated document
  revision.
- Create the initial idea snapshot in the same transaction as the project.
- Save each update snapshot and current project fields in one transaction.
- Backfill one inception snapshot for existing projects and associate existing
  revisions with it.
- Existing approved projects remain valid and are exempt from new
  pre-approval consistency checks.

## Current project correction

- Correct the current project’s local Idea name from the description-derived
  value to `ray`.
- Append a local **Idea updated** snapshot noting that the Idea name was aligned
  with the already approved technical specification and Sample NDA.
- Do not change either approved PDF, its digital fingerprint, its `.ots` file,
  or the approval time.

## Error handling and compatibility

- Missing or blank Idea names return the existing project-input validation
  response with wording updated to mention the Idea name.
- Reject idea edits after approval.
- Keep the latest successfully generated revision if the sibling document
  regeneration fails and clearly identify the document that needs retry.
- Do not enable approval while either selected document belongs to an older
  idea snapshot.
- Existing proof packages and OpenTimestamps proofs remain valid.
- Existing project URLs remain unchanged.

## Verification

- Project API and database tests cover required Idea name validation and exact
  title storage, initial snapshot creation, append-only updates, history order,
  and the approval lock.
- Migration tests cover existing project backfill without changing approvals or
  proof artifacts.
- Prompt tests confirm both document prompts receive the latest Idea name and
  raw idea description.
- API and UI tests cover explicit two-document regeneration, partial failure,
  stale-document approval prevention, and successful retry.
- UI tests cover the new field, editable Review details, Project history,
  removal of the two contextual Verify proof links, removal of Proof record,
  the compact heading, and the two-sentence timestamp presentation.
- Proof-status tests cover the immediate OpenTimestamps progress message and
  its replacement by the final result.
- The full unit suite, type check, lint, production build, and browser flow run
  before completion.
- The README screenshots are regenerated and visually inspected.
