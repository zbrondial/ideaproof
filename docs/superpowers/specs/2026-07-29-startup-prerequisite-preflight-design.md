# Startup Prerequisite Preflight Design

## Goal

Make a fresh IdeaProof clone safe and predictable to run on a local machine.
Both development and production startup must verify every prerequisite needed
by the app's core document-generation and timestamping workflows before
Next.js begins accepting requests.

Startup must either leave the machine ready to use IdeaProof or stop with
concise, actionable remediation. It must not boot a partially functional
webapp.

## Startup contract

The prerequisite preflight runs automatically before both:

- `npm run dev`;
- `npm start`.

The preflight validates, in order:

1. Node.js 24.14 or newer;
2. npm 10 or newer;
3. Python 3.9 or newer;
4. readable environment configuration from the process and/or `.env`;
5. at least one non-empty `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`;
6. a creatable and writable `IDEAPROOF_DATA_DIR`;
7. the project-local OpenTimestamps client at the pinned version.

Next.js starts only when every check succeeds.

## Architecture

Add one standalone prerequisite module under `scripts/`. Its checks expose
dependency-injected boundaries so version detection, environment loading,
filesystem access, and child processes can be tested without changing the
developer machine.

Wire the module into npm's `predev` and `prestart` lifecycle hooks. This keeps
the existing `dev` and `start` commands recognizable and lets npm stop the
command automatically when preflight exits nonzero.

Keep `npm run setup` as an explicit command. Refactor its existing Python and
OpenTimestamps setup logic for reuse by the preflight rather than maintaining
two installation implementations.

## Environment configuration

The preflight loads `.env` when that file exists, using the same simple
key/value conventions the server expects. Existing process environment values
take precedence over file values so shell, CI, and hosting configuration
continue to work. A missing `.env` is allowed when the process environment
provides all required values; an unreadable or malformed existing file fails
preflight.

Startup fails when both supported provider keys are missing or blank. The
error explains that at least one key is required and points to `.env.example`.
It never prints, logs, hashes, or otherwise includes secret values.

The configured data directory defaults to `./data`, matching the server. The
preflight creates the directory when absent and proves writability using a
temporary probe that is removed before startup continues.

## OpenTimestamps installation

The preflight resolves the platform-specific project executable:

- `.venv/bin/ots` on macOS and Linux;
- `.venv/Scripts/ots.exe` on Windows.

If it reports OpenTimestamps `0.7.2`, startup continues without network access
or package installation. If the executable is absent or reports another
version, the preflight uses the detected Python interpreter to:

1. create `.venv` when needed;
2. install `opentimestamps-client==0.7.2`;
3. rerun the executable version check.

Installation success is determined by the final executable check, not only by
the package manager's exit code.

The app may install this pinned project-local Python package automatically. It
must not install or upgrade system Python, Node.js, npm, API keys, operating
system packages, or global tools.

## Failure behavior

Each failure exits nonzero before Next.js starts and reports:

- the failed prerequisite;
- the detected value when safe and useful;
- the required value;
- one concrete remediation command or documentation pointer.

Failures include unsupported runtime versions, unavailable Python, missing
provider configuration, an unwritable data directory, virtual-environment
creation failure, package installation failure, and a missing or wrong
OpenTimestamps version after installation.

Errors avoid stack traces for expected setup problems and never expose API
keys. Unexpected internal failures retain a concise top-level message and a
nonzero exit code.

## User workflow and documentation

The primary README workflow becomes:

1. clone the repository;
2. copy `.env.example` to `.env`;
3. add at least one supported provider key;
4. run `npm install`;
5. run `npm run build`;
6. run `npm start`.

The explicit `npm run setup` step is no longer required because startup
installs the project-local OpenTimestamps dependency when necessary.

The Requirements and Troubleshooting sections continue to state that Node,
npm, and Python are machine prerequisites. Troubleshooting explains that
automatic OpenTimestamps installation needs package-index network access on
the first run and that later starts work offline when the pinned executable is
already present.

## Testing

Unit tests cover:

- supported and unsupported Node, npm, and Python versions;
- Python discovery across macOS/Linux and Windows command candidates;
- missing `.env` with and without valid process configuration, missing keys,
  blank keys, process-environment precedence, and valid single-provider or
  dual-provider configuration;
- secret values never appearing in output;
- default, custom, creatable, writable, and unwritable data directories;
- an already-correct OpenTimestamps executable avoiding installation;
- missing and wrong-version executables triggering installation;
- virtual-environment creation, installation, and final-version-check
  failures;
- the exact Windows and POSIX executable paths;
- nonzero preflight exit behavior for every failed prerequisite.

Contract tests confirm `predev` and `prestart` invoke the shared preflight.
A smoke test proves Next.js starts after a successful preflight and does not
start after a failed one.

Before completion, run the unit suite, type check, relevant lint checks,
production build, smoke startup, and a browser verification of the live setup
page.

## Scope boundaries

This change does not:

- install Node.js, npm, Python, system packages, or global commands;
- create, request, or validate provider credentials against external APIs;
- change document generation, proof creation, or verification semantics;
- require Docker;
- add an interactive setup wizard before startup;
- transmit local configuration or prerequisite results off the machine.
