# IdeaProof

IdeaProof is an open-source, local-first web app for turning an early product
idea into two concise, reviewable documents:

- a technical specification;
- a simple mutual NDA template.

After review, IdeaProof renders the selected revisions as deterministic PDFs,
hashes their exact bytes, and submits timestamp commitments with
OpenTimestamps. It runs in your browser at
[http://localhost:3000](http://localhost:3000), while the application and its
SQLite data remain on your machine.

![IdeaProof home screen](docs/images/ideaproof-home.png)

![IdeaProof document review screen](docs/images/ideaproof-review.png)

## Important limits

IdeaProof does not prove ownership, authorship, patent rights, or legal
validity. A confirmed timestamp shows only that exact file bytes existed by a
certain time. The NDA is a template, not legal advice, and AI-generated content
can contain errors. Review both documents before approval and consult a
qualified lawyer when appropriate.

Document generation sends the required idea and NDA content to OpenAI using
your API key. Verification does not send uploaded PDFs to OpenAI.

## Requirements

- Node.js 24.14 or newer
- npm 10 or newer
- Python 3.9 or newer
- an OpenAI API key

## Install and run

1. On GitHub, choose **Code**, select **HTTPS**, and copy the repository URL.
2. Clone that URL and enter the project:

   ```bash
   git clone <HTTPS URL copied from GitHub>
   cd ideaproof
   ```

3. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

4. Open `.env` and set:

   ```dotenv
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-5.6
   IDEAPROOF_DATA_DIR=./data
   ```

   Add your API key after the equals sign.

5. Install the Node and project-local OpenTimestamps dependencies:

   ```bash
   npm install
   npm run setup
   ```

6. Build and start:

   ```bash
   npm run build
   npm start
   ```

7. Open [http://localhost:3000](http://localhost:3000).

The API key stays in the server process and is not returned to the browser,
stored in SQLite, or included in proof packages. Keep `.env` private; it is
ignored by Git.

## Development

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run verify
```

The end-to-end suite uses development-only deterministic fixtures. It does not
call OpenAI or public timestamp calendars.

## Local data and backups

By default, IdeaProof stores its SQLite database and approval artifacts under
`data/`. Change `IDEAPROOF_DATA_DIR` to use another local folder.

To back up your work, stop IdeaProof and copy the entire data directory.
Application-level encryption is not provided, so use your operating system's
disk encryption and access controls when the ideas are sensitive.

## Proof packages

Each approved ZIP contains only:

- `technical-specification.md`
- `technical-specification.pdf`
- `technical-specification.pdf.ots`
- `mutual-nda.md`
- `mutual-nda.pdf`
- `mutual-nda.pdf.ots`
- `manifest.json`

The manifest identifies the approved revisions, prompt versions, word counts,
models, PDF SHA-256 hashes, and approval time. It excludes intake text, revision
feedback, API keys, database files, and internal paths.

OpenTimestamps confirmation can take hours. Use **Check confirmation** on the
proof page later. To verify independently in IdeaProof, open **Verify** and
select a PDF together with its matching `.ots` file. Any change to the PDF
causes a mismatch.

## Optional Docker Compose

Docker is not required and does not change the UI. The direct setup above is
the primary workflow. If Docker is available:

```bash
cp .env.example .env
# Add OPENAI_API_KEY to .env
docker compose up --build
```

Compose binds only `127.0.0.1:3000` and mounts `./data` for persistence.

## Troubleshooting

### Setup status

Open [http://localhost:3000/setup](http://localhost:3000/setup) to check the API
key, writable data folder, Python, and the project-local `ots` executable. The
page reports readiness without exposing secret values or internal paths.

### OpenTimestamps is missing

Confirm Python is available, then rerun:

```bash
python3 --version
npm run setup
```

On Windows, `py -3 --version` is also supported.

### OpenAI generation fails

Check `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`, then restart IdeaProof.
Authentication, rate-limit, refusal, malformed-output, and length errors are
reported without logging the key or raw response.

### Proof remains pending

This is expected until a Bitcoin attestation becomes available. Wait and use
**Check confirmation** again. Do not edit the PDF or `.ots` file.

### Port 3000 is already in use

Stop the process using port 3000 before starting IdeaProof. The supported
browser URL is `http://localhost:3000`.

## Project policies

See [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE), and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The MIT license covers IdeaProof's original source code. It does not replace
the licenses of third-party packages, fonts, generated content, or user data.
