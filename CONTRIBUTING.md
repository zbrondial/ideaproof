# Contributing to IdeaProof

Thank you for helping improve IdeaProof.

## Development workflow

1. Install the prerequisites documented in `README.md`.
2. Create a focused branch.
3. Write or update a failing test before implementation.
4. Make the smallest change that passes the test.
5. Run the complete gate:

   ```bash
   npm run verify
   npm run test:e2e
   ```

Keep API keys, personal ideas, generated user documents, local SQLite files,
downloads, and `.ots` files out of fixtures and commits.

## Changes that need extra care

- Prompt changes must increment the relevant prompt-template version and update
  schema, length, injection-resistance, and snapshot expectations.
- Provider changes must preserve server-only API keys, one immutable
  provider/model per project, safe error messages, and deterministic OpenAI and
  Anthropic fixtures.
- Schema changes must use a new ordered SQL migration. Never edit an applied
  migration in place.
- PDF changes must preserve deterministic bytes, embedded-font licensing,
  multipage behavior, visible NDA blanks, and visual inspection.
- Proof changes must invoke executables with argument arrays and `shell: false`.
  Never construct shell commands from filenames. New proof packages use
  Manifest V2 and identify the provider and model for each approved revision;
  retain Manifest V1 reading compatibility.
- Upload changes must preserve size checks before writes, generated filenames,
  and cleanup in `finally`.

## README screenshots

Screenshots use deterministic fixtures and contain no keys or personal data:

```bash
npm run test:e2e -- tests/e2e/screenshots.spec.ts
```

Visually inspect both files under `docs/images/` before committing them. The
fixture journey must not contain API keys or personal data.

## Pull requests

Describe the user-visible outcome, tests run, migrations or prompt-version
changes, and any known limitation. Keep unrelated refactors in separate pull
requests.
