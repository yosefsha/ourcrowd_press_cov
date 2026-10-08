# Project status and working notes for coding agents

Read this before starting work. Updated 2026-10-08. User-facing behaviour is in the
[README](../README.md); the vocabulary in [CONTEXT.md](../CONTEXT.md); decisions in
[docs/adr/](adr/); the design in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Where things stand

- **M0 (scaffold) and M1 (pipeline & API) are merged.** So are the frontend, the README (#38),
  the Compose fix (#39), classifier validation (#40) and parallel classification (#41).
- **Open issues (M3 — Delivery):**
  - **#20 Full real run and `data/` snapshot.** Start the stack, review the Needs Review companies,
    run a full Backfill, commit `data/`, then fill in `data/README.md`.
  - **#19 README.** It was merged with "Refs". Close it in #20's PR, after replacing "pending #20" in
    the README with the run date and counts and removing the Status note at the top.
  - **#18 Validation.** Done: the labels, `docs/validation-report.md` and the README results.
    Close it together with #19 and #20.
- **Follow-ups not yet filed as issues (ask the user before opening them):**
  - an Origin/CSRF check on mutating endpoints;
  - `import-data` should stop the collector first;
  - a CollectorActivity "importing" state, separate from the heartbeat row;
  - atomic status transitions, which need a change to the companies repository port;
  - no publisher-URL resolution for Articles already stored, which needs a NewsSource port change;
  - re-recording the frontend fixtures from the real API;
  - running the root `scripts/` tests in CI;
  - a Needs Review count endpoint;
  - updating ADR-010 for the resumable Seed List import;
  - `eval:classifiers` skipping title rows that spreadsheets add above the CSV header;
  - the validation-set builder importing `pipeline/name-check` instead of its copy;
  - a unit test for parallel classification with concurrency > 1 (the failure threshold and the
    order of progress reports).

## Running the system: things that are not obvious

- **Nothing collects until a Run is started.** `npm start` only imports the Seed List. The
  dashboard shows "No coverage" for every company until a Backfill runs (Operations → Start
  Backfill).
- **About 150 companies are active and about 110 are in Needs Review after the import.** This is
  by design (ADR-010): Runs skip Needs Review companies until a person reviews them. It is not a
  bug.
- **Port 5432 is often taken** by a native Postgres (on the user's Mac, the Homebrew
  `postgresql@18` service). The compose Postgres publishes to the host for host-side tools only.
  Use `POSTGRES_HOST_PORT=5433 npm start`. Never stop the user's native Postgres without asking.
- **Host-side commands need `npm ci`** in `backend/` (and `frontend/`) of the checkout you run them
  from. A fresh worktree has no `node_modules`; symlinking the primary checkout's works.
- **Image tags are per compose project** (`press-coverage-backend:<project>`). Pass `--build` when
  a stack must run the current branch.
- **Parallel classification only helps if Ollama itself runs with `OLLAMA_NUM_PARALLEL`** matching
  the collector's setting (default 2).

## Rules for agents working here

- **One Ollama job at a time.** Ollama runs natively on the host (ADR-007) and is shared. Latency
  measurements, `record-verdicts`, `test:live` and a Backfill skew or slow each other. Ask before
  starting anything that calls real Ollama, and never stop or restart it.
- **Test suites never call Ollama.** Boot the collector in e2e specs with
  `createCollectorContext()` (`backend/test/support/collector-context.ts`). By default it overrides
  CLASSIFIER_HEALTH, AMBIGUITY_TRIAGE and the Seed List source. Use the recorded real verdicts in
  `backend/test/fixtures/ollama/` and the recorded feeds (ADR-006). The running system never uses
  fake data.
- **Verify against your own Postgres:**
  `POSTGRES_HOST_PORT=555NN docker compose -p <task> up -d postgres`, then `migration:run`, the
  checks, and `docker compose -p <task> down -v`. Never use the shared dev DB or port 5432.
- **e2e specs must not write `data/`.** Override DATA_EXPORTER with a no-op when the run worker is
  booted.
- **Kill only processes you started.** Never `pkill -f "node dist/main.js"`.
- Branch, worktree, PR feedback loop and merge rules: [CLAUDE.md](../CLAUDE.md). The user merges.
