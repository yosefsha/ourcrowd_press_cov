# Architecture Decision Records (combined)

All ADRs from [docs/adr/](adr/) in one file, for reading end to end. The individual files in `docs/adr/` remain the source of truth; edit those, then regenerate this copy.

## Contents

- [ADR-001: Google News RSS search as the first News Source, behind a port](#adr-001-google-news-rss-search-as-the-first-news-source-behind-a-port)
- [ADR-002: Relevance and sentiment are separate classification steps](#adr-002-relevance-and-sentiment-are-separate-classification-steps)
- [ADR-003: Company Profiles are hand-curated in a file beside the seed list (superseded by ADR-010)](#adr-003-company-profiles-are-hand-curated-in-a-file-beside-the-seed-list)
- [ADR-004: Alerts are per-run digests shown in the dashboard](#adr-004-alerts-are-per-run-digests-shown-in-the-dashboard)
- [ADR-005: Postgres is the source of truth; the data folder is a complete export](#adr-005-postgres-is-the-source-of-truth-the-data-folder-is-a-complete-export)
- [ADR-006: Real data only at runtime; tests use recorded real fixtures](#adr-006-real-data-only-at-runtime-tests-use-recorded-real-fixtures)
- [ADR-007: Ollama runs natively on the host, not in Docker Compose](#adr-007-ollama-runs-natively-on-the-host-not-in-docker-compose)
- [ADR-008: Article identity is the Google article ID; a Mention is per (Article, Tracked Company)](#adr-008-article-identity-is-the-google-article-id-a-mention-is-per-article-tracked-company)
- [ADR-009: Collector runs separately from the API; Runs are queued in Postgres](#adr-009-collector-runs-separately-from-the-api-runs-are-queued-in-postgres)
- [ADR-010: Tracked Companies live in the database, behind a review gate](#adr-010-tracked-companies-live-in-the-database-behind-a-review-gate)

---

## ADR-001: Google News RSS search as the first News Source, behind a port

_Source: [adr/ADR-001-google-news-rss-behind-news-source-port.md](adr/ADR-001-google-news-rss-behind-news-source-port.md)_

Candidates are fetched through a `NewsSource` port named in domain terms ("news items about this Tracked Company in this window"), and the first implementation is Google News RSS search. It is the only free, keyless option that covers a full quarter and returns a snippet the classifiers can read, so a reviewer can run the project with nothing but Ollama installed. NewsAPI, a scraper or GDELT are added later as new implementations without editing the code that consumes the port.

### Considered Options

- **GDELT DOC 2.0** — free and official with real article URLs, but titles only (no snippet) and noisy, non-English-heavy results.
- **NewsAPI.org** — free tier reaches back only one month and is licensed for development only, so it cannot satisfy the quarterly view.
- **Scraping company press pages** — yields a company's own announcements, not press coverage.

### Consequences

- Google News RSS is unofficial and undocumented; its format can change without notice.
- Each query returns at most ~100 items, so heavily covered companies (SpaceX, Stripe, Anthropic) are sampled, not exhaustively counted. The window is deliberately not split into time slices to get past this cap — that would multiply Candidates (and LLM time) for exactly those companies — so their ~100 items may also cluster in time rather than spread across the quarter.
- Searches run against configurable Google News editions (`NEWS_EDITIONS`, default `en-US,he-IL`): many portfolio companies are Israeli and much of their coverage appears only in the Hebrew press. Each edition is a separate query, so Candidates roughly double, and classifier prompts accept Hebrew input while always answering in English JSON. A story and its translation are different Articles.
- Item links are Google redirect URLs and must be resolved to the publisher URL before storage and de-duplication.

---

## ADR-002: Relevance and sentiment are separate classification steps

_Source: [adr/ADR-002-two-stage-relevance-then-sentiment.md](adr/ADR-002-two-stage-relevance-then-sentiment.md)_

Every Candidate is first judged by a `RelevanceClassifier` ("is this article about this Tracked Company?"); only a Candidate judged relevant becomes a Mention and is passed to a `SentimentClassifier` ("is this article positive, negative or neutral toward the company?"). Both run on the local Ollama model, each article is classified at most once per step, and the relevance verdict is stored with its reason so rejected Candidates remain auditable.

### Considered Options

- **One combined prompt returning `{ relevant, sentiment }`** — one call per Candidate instead of up to two, but the two answers are coupled: tuning one shifts the other, and their quality cannot be measured independently. The saving is small because sentiment is skipped entirely for rejected Candidates, which are numerous for ambiguous names (Harvey, Wave, Ro, Island…).

### Consequences

- Classification quality is validated per step: relevance precision and sentiment accuracy are reported separately.
- Each step can be swapped to a different model or prompt independently.
- Rejected Candidates are persisted, not dropped, so the daily run never re-classifies an article it has already seen.

---

## ADR-003: Company Profiles are hand-curated in a file beside the seed list

_Source: [adr/ADR-003-curated-company-profiles-file.md](adr/ADR-003-curated-company-profiles-file.md) · **Status: superseded by ADR-010**_

The seed list (`ourcrowd_companies.txt`) stays the single source of truth for *which* companies are tracked; a hand-curated `companies.json` enriches entries with optional aliases (including "formerly X" names), domain, a one-line description and search terms. The seed list is names only and many names are ordinary words, so without this context neither the search nor the RelevanceClassifier can tell Harvey the legal-AI company from Hurricane Harvey. Startup fails if `companies.json` names a company absent from the seed list; a company with no profile falls back to its quoted name.

### Considered Options

- **LLM-generated descriptions** — automatic, but an LLM confidently invents descriptions for obscure or defunct startups, and those errors would silently steer relevance decisions.
- **Profiles stored in the database with an editing API** — deferred, not rejected. The file is versioned, reviewable in a pull request, and enough for a fixed seed list.

Superseded: profiles and the company list itself moved into the database with an editing page, and the seed list became a starter only — see ADR-010.

---

## ADR-004: Alerts are per-run digests shown in the dashboard

_Source: [adr/ADR-004-alerts-as-dashboard-digests.md](adr/ADR-004-alerts-as-dashboard-digests.md)_

Each Daily Check that finds new Mentions produces one Alert Digest, stored in the database and surfaced as a notification in the dashboard until acknowledged; it is also written to the log and to `data/alerts/<date>.json`. A digest groups the new Mentions by Tracked Company with negative Mentions first, because a reader scanning a morning summary must not have one negative story about a small company buried under twenty routine SpaceX items. Delivery goes through an `AlertNotifier` port so other channels can be added without touching the Daily Check.

### Rules

- A Mention is **new** when it is first confirmed as a Mention in this Daily Check — not when it was published (Google News often surfaces articles a day or two late) and not when it was first fetched (a Candidate left unclassified because Ollama was down must still alert once a later Run confirms it).
- A Mention first seen today but published more than **7 days** ago is stored and shown but does not alert; it is no longer news.
- The **Backfill never alerts**, or the first run would raise thousands of "new" Mentions.
- A Daily Check with no new Mentions produces no digest, only a log line.

### Considered Options

- **One alert per Mention** — noisy for heavily covered companies; deferred as an immediate alert for negative Mentions only (see backlog).
- **Slack webhook / email** — deferred. Email needs SMTP credentials a reviewer would have to supply; the dashboard is visible with no setup.

---

## ADR-005: Postgres is the source of truth; the data folder is a complete export

_Source: [adr/ADR-005-postgres-source-of-truth-data-folder-export.md](adr/ADR-005-postgres-source-of-truth-data-folder-export.md)_

All Candidates, Relevance Verdicts, Mentions, Sentiments, Alert Digests and run history live in Postgres, which the dashboard, the Daily Check and de-duplication read from. The `data/` folder required by the brief is a complete, versioned (`schemaVersion`) export written after every Backfill and Daily Check — including rejected Candidates with their reasons, first-seen timestamps and digest acknowledgement state — so reviewers can inspect results, and the classification-quality evidence, without running anything.

### Reading the export back — softened, for dev and presentation only

The export was originally one-way. That restriction is softened: `npm run import-data` may load `data/` into an **empty** database, solely so a developer or reviewer can see the full dashboard from a committed real run without waiting hours for a Backfill. It is not a sync, backup or migration mechanism: it refuses to run against a database that already holds data, never merges, and the dashboard then shows the snapshot's "as of" date. In normal operation nothing reads `data/`.

### Considered Options

- **Files only** — the brief allows it, but de-duplication, "first seen" tracking for alerts, unacknowledged-alert state and Coverage Window queries all become hand-rolled indexing over JSON.
- **SQLite** — no container needed, but the project template, CI and deploy pipeline are built on Postgres and TypeORM migrations.
- **Committed `pg_dump` for restoring** — no import code, but opaque in review, coupled to the Postgres version and migration level, and a second artifact of the same run that can drift from `data/`. The domain-shaped JSON export survives schema changes.

### Consequences

- The export must stay lossless with respect to what the dashboard and alerting need; a field added to the schema but not to the export silently disappears from an imported snapshot. A round-trip test (export → import into empty DB → export) guards this.
- An imported snapshot ages: the rolling Coverage Window moves on while the data does not.

---

## ADR-006: Real data only at runtime; tests use recorded real fixtures

_Source: [adr/ADR-006-real-data-only-recorded-fixtures-in-tests.md](adr/ADR-006-real-data-only-recorded-fixtures-in-tests.md)_

The running system — Backfill, Daily Check, dashboard and the committed `data/` snapshot — only ever holds data fetched from real News Sources and classified by the real Ollama model: no seed scripts, no demo mode, no invented companies or articles. To see an alert immediately, the Backfill accepts an `until` cutoff (API and dashboard control) so the following Daily Check finds the most recent days as genuine New Mentions.

Automated tests replace the ports with in-memory implementations, as the backend standard requires, because CI has neither internet access to a stable feed nor an Ollama runtime. Their contents are recorded from real Google News RSS responses and real Ollama verdicts and committed as fixtures, never hand-written. An optional `npm run test:live`, outside CI, exercises real Google News and real Ollama for a few companies to detect feed-format or model-output drift.

### Considered Options

- **Demo / seed mode** — rejected: a reviewer could not tell demo output from real results.
- **Tests against live services** — rejected for CI: results change hourly and CI has no Ollama, so assertions could not be stable.

---

## ADR-007: Ollama runs natively on the host, not in Docker Compose

_Source: [adr/ADR-007-ollama-runs-natively-on-host.md](adr/ADR-007-ollama-runs-natively-on-host.md)_

Ollama is the one runtime dependency deliberately absent from `docker-compose.yml`. Docker Desktop on macOS runs containers in a Linux VM with no access to the Apple GPU (Metal), so a containerised Ollama falls back to CPU and runs a 7B model roughly 3–5× slower — decisive when a Backfill means thousands of classification calls. The backend reaches the host's Ollama through `OLLAMA_BASE_URL` (`http://localhost:11434` natively, `http://host.docker.internal:11434` from a container) and the collector refuses to boot if Ollama is unreachable or the configured model is not pulled (the API does not depend on Ollama — see ADR-009).

### Considered Options

- **`ollama` service in Docker Compose** — one fewer install step, but CPU-only on macOS. Worth it only on a Linux host with an NVIDIA GPU and the container toolkit; documented in the README as an option, not built.

### Consequences

- Setup has one host prerequisite beyond Docker: Ollama itself, with `qwen2.5:7b` pulled.
- Cloud deployment is out of scope for this project, so how Ollama would run on ECS is not decided here.

---

## ADR-008: Article identity is the Google article ID; a Mention is per (Article, Tracked Company)

_Source: [adr/ADR-008-article-identity-and-mention-per-company.md](adr/ADR-008-article-identity-and-mention-per-company.md)_

An Article from Google News is identified by its Google article ID (the `CBMi…` token in its `news.google.com/rss/articles/…` link), not by the publisher URL. Since 2024 those links resolve only through a JavaScript redirect, and resolving them server-side depends on an undocumented Google endpoint; the ID is stable and always present. The publisher URL is resolved best-effort and preferred as the outbound link when found; otherwise the Google link is stored, which still opens the Article in a browser.

A Mention is keyed by (Article, Tracked Company), because Sentiment is judged toward a company and one Article can be positive for one Tracked Company and negative for another. Syndicated copies of a story at different Outlets are separate Articles and separate Mentions, matching how press coverage is counted ("covered by 30 outlets").

### Consequences

- De-duplicating across News Sources will require the resolved publisher URL; Articles where resolution failed cannot be matched across sources.
- Mention counts include syndicated copies; grouping them into one story is a backlog item.

---

## ADR-009: Collector runs separately from the API; Runs are queued in Postgres

_Source: [adr/ADR-009-collector-separate-from-api-postgres-run-queue.md](adr/ADR-009-collector-separate-from-api-postgres-run-queue.md)_

The backend has two entry points built into one image and deployed as two containers, one process each: `api` (`node dist/main.js`, HTTP only) and `collector` (`node dist/worker.js`, no HTTP), which executes Backfills and Daily Checks and owns the flag-controlled daily cron (`DAILY_CHECK_SCHEDULE_ENABLED`, `DAILY_CHECK_CRON`). The API never fetches news or calls Ollama — its module graph does not import the News Source or classifier modules, and a lint rule enforces that boundary. They coordinate only through Postgres: the API inserts a Run with status `queued` (returning 202, or 409 while another Run is queued or running, enforced by a partial unique index); the collector claims it with `SELECT … FOR UPDATE SKIP LOCKED`, writes progress to the Run row, and records a heartbeat with its Ollama health that the dashboard displays.

### Considered Options

- **Two processes in one container** — rejected: needs a supervisor, hides one process's crash behind the other, and prevents independent restart and scaling.
- **Separate image per role** (Dockerfile targets) — two images to build and push for near-identical dependencies; one image also guarantees both roles run the same code against the same schema.
- **Separate `collector/` package** — duplicates domain types and entities or forces a shared package, and adds a third service to CI.
- **Redis + BullMQ** — a new service in docker-compose and CI for a queue that holds at most one job.
- **pg-boss** — a reasonable Postgres-backed queue, but a library and its own schema for what the Runs table, needed anyway for the lock, progress and history, already provides.

### Consequences

- Only the collector requires Ollama at boot (refines ADR-007); the API and dashboard stay up when Ollama is down and report it from the heartbeat.
- Enqueueing sits behind a `RunQueue` port, so moving to SQS or an EventBridge-launched ECS task later replaces one adapter.
- A Run is picked up within the collector's polling interval (a few seconds), not instantly.

---

## ADR-010: Tracked Companies live in the database, behind a review gate

_Source: [adr/ADR-010-tracked-companies-in-db-with-review-gate.md](adr/ADR-010-tracked-companies-in-db-with-review-gate.md)_

Supersedes ADR-003. The database is the source of truth for Tracked Companies and their Company Profiles, edited through a dedicated dashboard page; `ourcrowd_companies.txt` is only a starter, imported once into an empty table. Each Tracked Company has a database-generated integer id, because every human-facing field — display name included — is editable. The one read-only field is the **source name**, the raw seed-list line; companies added on the page have no source name, which marks them as not from the OurCrowd list. Display name, "formerly" alias and domain are pre-filled by parsing the seed line and editable like everything else. Profile fields are validated server-side.

### Review gate

At import the collector triages every company: a rule set (single common English word or first name from a bundled word list, or ≤ 3 characters) and a one-off Ollama question ("would a news search for this exact name mostly return unrelated articles?" → `{ ambiguous, reason }`, flagging on any doubt). A company flagged by either starts as **Needs review** and is excluded from Runs until a person reviews its profile on the company page; the rest are collected immediately. Some companies therefore have no coverage at first — accepted. Unlike the LLM-written descriptions rejected in ADR-003, the model here only raises a flag a person resolves, and errs toward a review rather than toward wrong data. As a safety net the dashboard surfaces companies with a high relevance-rejection rate, and any company can be sent back to Needs review.

### Lifecycle

- **Deactivate, never delete.** A deactivated company is excluded from Runs and the dashboard; its Candidates and Mentions are kept for audit. Re-adding the company creates a new Tracked Company with a new id.
- **Re-process company** deletes that company's Candidates, Relevance Verdicts and Mentions and queues a Backfill limited to it — a fresh search and classification with the current profile. History is replaced, not versioned, and, being a Backfill, it never alerts. Offered after editing a profile and after completing a review.
- Profile edits affect future Runs only until the company is re-processed.

### Considered Options

- **Curated seed file reviewed in a pull request** — rejected: review belongs in the product, next to the data it affects.
- **Ambiguity by rules only** — misses rare words common in news and flags harmless names. **Probe search** (classify sample results per company) — most accurate, but ~2,500 LLM calls before anything starts.
- **Profile versions recorded on Mentions** — rejected in favour of replacing history on re-process.
