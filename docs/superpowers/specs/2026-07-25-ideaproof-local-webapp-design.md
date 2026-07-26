# IdeaProof Local Web App Design

**Date:** July 25, 2026

## Purpose

IdeaProof is an open-source, local-first web application for turning an early
software idea into two concise documents, reviewing revisions, and creating a
verifiable timestamp for the exact approved files.

The application runs on the user's machine and is accessed at
`http://localhost:3000`. It requires no IdeaProof account and no hosted
IdeaProof service. Users supply their own OpenAI API key.

## Product boundaries

Version 1 includes:

- local projects and revision history;
- OpenAI-generated technical specifications and mutual NDA templates;
- concise, versioned prompt templates based on the supplied design reference;
- review, feedback, approval, PDF generation, and downloads;
- SHA-256 document fingerprints;
- real OpenTimestamps proof creation, upgrade, and verification;
- searchable proof logs;
- a text-first README with GitHub screenshots;
- direct local installation as the primary supported path;
- optional Docker Compose installation.

Version 1 excludes:

- user accounts, authentication, teams, or permissions;
- hosted storage, sync, remote backup, or collaboration;
- analytics or telemetry;
- application-level encryption;
- document signing or electronic signatures;
- legal advice or guarantees about document enforceability;
- proof of ownership, patent rights, copyright registration, or idea validity;
- automatic background jobs or a continuously running proof-upgrade worker.

## Licensing boundary

The new application code will use the MIT License with the notice
`Copyright (c) 2026 IdeaProof contributors`.

The files `ideaproof_design/support.js`,
`ideaproof_design/animations-v2.jsx`, and
`ideaproof_design/tweaks-panel.jsx` identify themselves as copied Omelette
starter scaffolding and contain no license notice. They are local design
references only. The implementation must not copy, import, bundle, or ship
their code. Before the repository is made public, those files must either have
documented redistribution permission or be removed from the public history.
The new application will independently recreate the visible design.

Third-party dependencies retain their own licenses. The official
`opentimestamps-client` is LGPL-3.0-or-later and runs as a separate command-line
process; its license and attribution will be recorded in
`THIRD_PARTY_NOTICES.md`.

## Supported runtime and installation

The primary installation path is a direct local build:

```bash
cd ideaproof
cp .env.example .env
npm install
npm run setup
npm run build
npm start
```

The GitHub README places the repository's actual clone URL immediately before
this command block and tells the user to open `http://localhost:3000`.

Runtime requirements:

- Node.js 24 LTS;
- Python 3.9 or newer;
- npm 10 or newer;
- macOS, Linux, or Windows with PowerShell;
- network access for OpenAI generation and OpenTimestamps calendar requests.

`npm run setup` runs a cross-platform Node script. It detects a supported
Python command, creates `.venv` inside the project, and installs the pinned
`opentimestamps-client==0.7.2`. It never installs Python packages globally.

`npm start` runs the production Next.js server. `npm run dev` runs the
development server. A checked-in `docker-compose.yml` provides an optional
equivalent installation but is not required by the application or test suite.

## Configuration

`.env.example` documents:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
IDEAPROOF_DATA_DIR=./data
```

`OPENAI_API_KEY` is required for generation. `OPENAI_MODEL` is configurable and
defaults to `gpt-5.6`. `IDEAPROOF_DATA_DIR` defaults to a gitignored `data/`
directory.

The server reads configuration. Browser bundles, API responses, logs,
SQLite records, manifests, and ZIP packages must never contain the OpenAI API
key.

## Architecture

IdeaProof is one Next.js App Router application written in strict TypeScript.
A single `next start` process serves the interface and server routes.

The application uses five focused internal services:

1. **Project store** — SQLite projects, revisions, approved versions, and status
   transitions.
2. **Generation service** — OpenAI Responses API requests, versioned prompts,
   Structured Output schemas, refusals, and length enforcement.
3. **Document renderer** — safe Markdown previews and deterministic PDF
   generation.
4. **Proof service** — SHA-256 hashing and direct process invocation of the
   local `ots` executable for stamping, upgrading, and verification.
5. **Package service** — proof manifests and ZIP downloads.

The browser never connects directly to OpenAI, SQLite, Python, or an
OpenTimestamps calendar.

## Data model

### Project

- `id`: UUID
- `title`: derived from the idea and editable before approval
- `idea`: required plain text
- `technologyPreference`: optional plain text
- `ndaPurpose`: required plain text
- `ndaDetails`: optional free-form plain text
- `status`: `draft | generating | review | pending | confirmed | failed`
- `createdAt`: UTC timestamp
- `updatedAt`: UTC timestamp

### Revision

- `id`: UUID
- `projectId`: owning project
- `documentType`: `specification | nda`
- `version`: positive integer scoped to project and document type
- `content`: canonical UTF-8 Markdown
- `wordCount`: integer
- `feedback`: nullable plain text that produced this revision
- `promptTemplateVersion`: immutable string
- `model`: OpenAI model returned by the API
- `openaiResponseId`: nullable response identifier
- `createdAt`: UTC timestamp

### Approval

- `id`: UUID
- `projectId`: unique owning project
- `specificationRevisionId`: frozen specification revision
- `ndaRevisionId`: frozen NDA revision
- `approvedAt`: UTC timestamp
- `packagePath`: path relative to the data directory

### Proof artifact

- `id`: UUID
- `approvalId`: owning approval
- `documentType`: `specification | nda`
- `pdfPath`: path relative to the data directory
- `markdownPath`: path relative to the data directory
- `otsPath`: path relative to the data directory
- `sha256`: lowercase hexadecimal digest
- `status`: `pending | confirmed | failed`
- `bitcoinBlockHeight`: nullable integer
- `confirmedAt`: nullable timestamp parsed from verification
- `lastCheckedAt`: nullable UTC timestamp
- `errorCode`: nullable stable application error code

Approved revisions and generated artifacts are immutable. Editing approved
content requires a new project and a new proof.

## Screens and navigation

The implementation independently recreates the design reference's dark,
responsive visual language.

1. **Home** — explains the concise generate, review, approve, and verify flow.
2. **Proof Logs** — searches local projects and filters draft, pending, and
   confirmed states.
3. **Describe Idea** — accepts:
   - idea description, required;
   - preferred technology, optional;
   - NDA purpose, required;
   - additional NDA details, optional free-form text.
4. **Generating** — reports real specification generation, NDA generation,
   validation, and save progress.
5. **Review** — displays specification and NDA tabs, word counts, feedback,
   revision history, PDF previews, and approval.
6. **Approval dialog** — names the exact selected revisions and explains that
   the resulting files are immutable.
7. **Proof Status** — displays pending, confirmed, or failed proof state and
   provides proof-package downloads and explicit confirmation checks.
8. **Revision History** — lists each document version, its feedback, timestamp,
   and preview.
9. **Verify** — accepts one PDF and one `.ots` file and reports confirmed,
   pending, mismatched, or invalid.
10. **Terms** — explains OpenAI transmission, local storage, timestamp limits,
    and legal disclaimers.
11. **Setup Error** — reports missing configuration or runtimes with exact
    corrective commands.

The mobile layout keeps all core actions available and respects
`prefers-reduced-motion`.

## Document generation

The server makes separate OpenAI Responses API calls for the specification and
NDA. Both use Structured Outputs backed by Zod schemas so rendering never
depends on arbitrary model formatting.

The prompt templates are versioned source files. They state the outcome,
required sections, source facts, length ceiling, prohibited invention, legal
disclaimer, and stopping conditions. User input is delimited as source data and
is not treated as application instructions.

### Technical specification

The specification is limited to 1,200 words and contains:

1. idea summary;
2. problem and target user;
3. goals and non-goals;
4. core user flow;
5. proposed technical approach;
6. main data and integration boundaries;
7. risks and open decisions;
8. next implementation steps.

The model must not invent research, traction, metrics, legal claims, or
requirements not supported by the user's input.

### Mutual NDA template

The NDA is limited to 700 words and contains:

1. title and "Not legal advice" notice;
2. parties;
3. effective date;
4. purpose;
5. confidential information;
6. exclusions;
7. confidentiality obligations;
8. confidentiality period;
9. return or destruction;
10. signatures.

There is no governing-jurisdiction clause.

The purpose comes from the required intake field. OpenAI may use facts supplied
in the optional NDA details but must not invent missing legal facts. Missing
values render in Markdown and PDF as labeled blanks:

```text
Party A: ______________________
Party B: ______________________
Effective Date: ______________
Confidentiality Period: _______
```

The NDA is a starting template and not legal advice. Filling a blank after the
PDF is approved changes its bytes and requires a new timestamp proof.

### Length enforcement

The server counts words after schema validation. When output exceeds its
ceiling, the generation service makes one corrective request that preserves
required content while shortening the document. A second over-limit response
returns a stable error and preserves the project for retry.

## Revision workflow

The first successful document is revision 1. Feedback targets one document at
a time. A revision request sends the selected revision, its prompt template,
and the user's feedback to OpenAI. It does not regenerate the sibling document.

Every accepted response creates a new immutable revision. Earlier revisions,
their feedback, model, prompt version, word count, and timestamps remain
viewable. Users choose the active revision for each document before approval.

If one initial document generation fails, the successful sibling is retained.
Retry regenerates only the missing document.

## Approval and proof creation

Approval performs this sequence:

1. verify that both selected revisions exist and satisfy their schemas and word
   limits;
2. write canonical UTF-8 Markdown files;
3. render deterministic PDFs from those exact revisions;
4. calculate each PDF's SHA-256 digest;
5. invoke `ots stamp` separately for each PDF without a shell;
6. write `manifest.json`;
7. build the ZIP package;
8. store the approval and artifact records;
9. set the project to `pending`.

The ZIP contains:

```text
ideaproof-<project-slug>/
  technical-specification.pdf
  technical-specification.md
  technical-specification.pdf.ots
  mutual-nda.pdf
  mutual-nda.md
  mutual-nda.pdf.ots
  manifest.json
```

The manifest includes the project ID, approved revision IDs, filenames,
SHA-256 digests, word counts, prompt-template versions, model identifiers,
approval timestamp, and proof status at package creation. It never contains the
idea intake, API key, OpenAI request payload, or revision feedback.

If stamping fails, the PDFs, Markdown, hashes, and approval remain intact. The
project enters `failed` with a retryable proof error. Retrying proof creation
does not regenerate either document.

## Proof confirmation and verification

There is no background worker. The application runs `ots upgrade` and
`ots verify` when the user opens a pending proof or chooses "Check
confirmation." A still-incomplete timestamp remains pending. Successful
verification records the Bitcoin block height and confirmation time when the
client output provides them.

The Verify screen:

1. accepts one PDF no larger than 10 MB;
2. accepts one `.ots` file no larger than 1 MB;
3. copies both into a generated temporary directory;
4. invokes `ots verify` with direct process arguments;
5. maps output into `confirmed`, `pending`, `mismatch`, or `invalid`;
6. displays the SHA-256 digest and available confirmation details;
7. deletes the temporary files after the request.

User filenames are display metadata only. They are never used as filesystem
paths or shell input.

## Rendering and content safety

Markdown is canonical source content. Raw HTML is disabled. Links are rendered
without automatically loading remote resources. Generated output cannot embed
scripts, iframes, remote images, or executable attachments.

PDFs use bundled open-source fonts so rendering does not require Google Fonts
or any other remote asset. PDF metadata and layout inputs are fixed at approval
time to keep rendering reproducible for the approved revision.

## Privacy and security

- Idea input, NDA details, feedback, and the current document revision are sent
  to OpenAI only when required for generation or revision.
- The UI states this transmission before the first generation.
- IdeaProof itself has no hosted service and receives no user data.
- SQLite and artifacts remain under `IDEAPROOF_DATA_DIR`.
- Version 1 relies on normal operating-system file permissions and makes no
  encryption claim.
- OpenTimestamps receives opaque commitments rather than document contents,
  though request timing and network metadata may still be observable.
- API keys are redacted from application errors and logs.
- Server-only modules are used for environment access, SQLite, filesystem,
  OpenAI, PDF generation, and process invocation.
- SQL uses parameterized queries.
- File paths are generated from UUIDs rather than user text.
- OpenTimestamps commands use argument arrays with shell execution disabled.
- The app binds to `127.0.0.1` by default. Listening on other interfaces
  requires explicit configuration and is outside the documented v1 path.

## Error handling

Errors use stable codes and actionable messages:

- `SETUP_OPENAI_KEY_MISSING`
- `SETUP_PYTHON_MISSING`
- `SETUP_OTS_MISSING`
- `OPENAI_AUTH_FAILED`
- `OPENAI_RATE_LIMITED`
- `OPENAI_REFUSED`
- `OPENAI_OUTPUT_INVALID`
- `OPENAI_OUTPUT_TOO_LONG`
- `PDF_RENDER_FAILED`
- `OTS_CALENDAR_UNAVAILABLE`
- `OTS_STAMP_FAILED`
- `OTS_PENDING`
- `OTS_MISMATCH`
- `OTS_INVALID`
- `PACKAGE_BUILD_FAILED`
- `STORAGE_UNAVAILABLE`

Retryable operations are labeled. A failed operation never deletes an existing
revision, approval, proof, or package. Error details shown to users exclude
secrets, raw provider responses, internal paths, and stack traces.

## Testing strategy

Implementation follows test-driven development for non-trivial logic.

Unit tests cover:

- prompt construction and template versions;
- Zod schemas and refusal handling;
- word counting and the single shortening retry;
- state transitions;
- SHA-256 calculation;
- manifest construction;
- safe filenames and process arguments;
- OpenTimestamps output parsing.

Integration tests cover:

- SQLite migrations and revision history;
- independent specification and NDA retries;
- deterministic Markdown-to-PDF generation;
- approval immutability;
- ZIP contents;
- `ots` process success, pending, mismatch, invalid, and unavailable results
  through a fake executable;
- upload size and cleanup behavior.

Mocked OpenAI tests cover:

- successful structured generation;
- invalid credentials;
- rate limits;
- refusal;
- malformed or incomplete output;
- one over-limit response followed by a valid shortening response;
- two over-limit responses producing a stable error.

One Playwright flow covers:

1. create a project;
2. generate both documents;
3. revise one document;
4. select revisions;
5. approve;
6. download the proof ZIP;
7. upload a PDF and matching proof;
8. see the expected verification state.

The production smoke test runs `npm run build`, starts `npm start` without
Docker, and checks the home and setup-status routes. Docker Compose receives a
separate optional build check.

## README and repository documentation

The root `README.md` includes:

- a concise product description;
- what timestamp proof establishes and does not establish;
- screenshots of the finished application for GitHub visitors;
- Node.js, Python, and npm requirements;
- clone, `.env`, setup, build, and start commands;
- development and test commands;
- optional Docker Compose commands;
- OpenAI key and model configuration;
- local data location and backup guidance;
- proof-package contents;
- timestamp confirmation and manual verification instructions;
- privacy behavior;
- NDA legal disclaimer;
- troubleshooting;
- contribution guidance;
- MIT license notice;
- link to `THIRD_PARTY_NOTICES.md`.

Screenshots are generated from deterministic demo fixtures containing no user
data or API key and are stored under `docs/images/`.

Additional root files:

- `LICENSE` — standard MIT text for the new application code;
- `THIRD_PARTY_NOTICES.md` — runtime and bundled-asset licenses;
- `.env.example` — safe configuration template;
- `CONTRIBUTING.md` — setup, tests, and pull-request expectations.

## Success criteria

Version 1 is complete when a new user can:

1. clone the repository on a supported machine;
2. configure `.env`;
3. install project-local dependencies without Docker;
4. build and start IdeaProof at `http://localhost:3000`;
5. create a local project;
6. generate concise specification and NDA revisions using their OpenAI key;
7. review and revise both documents;
8. approve exact revisions;
9. download PDFs, Markdown, `.ots` files, and manifest in one ZIP;
10. check a pending proof until confirmation;
11. verify an approved PDF against its `.ots` proof;
12. restart the application and retain all local projects and artifacts.
