# Technical Specification: Press Coverage Monitor

**Audience:** an incoming tech lead.
**State described:** `main` as of 2026-10-08, with M0 and M1 merged and M3 in progress.

This document explains how the system is built and why. The other documents each cover one part:

| Document | What it holds |
|---|---|
| [README](../README.md) | How to run and use the system |
| [CONTEXT.md](../CONTEXT.md) | The domain vocabulary. The terms in **bold** below are defined there |
| [docs/adr/](adr/) | The ten decisions behind the design (ADR-001 to ADR-010) |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | The original build plan and milestone graph |
| [STATUS.md](STATUS.md) | Open work, follow-ups and agent rules |
| [BACKLOG.md](BACKLOG.md) | Deferred features |
| [TASKS.md](TASKS.md) | The original brief |

---

## 1. Purpose and scope

OurCrowd wants to know what the press says about its portfolio and fund companies. The system:

1. Monitors about 258 **Tracked Companies**, initialised from OurCrowd's **Seed List**
   (`docs/ourcrowd_companies.txt`).
2. Collects news **Candidates** from Google News in English/US and Hebrew/Israel.
3. Classifies each Candidate with a **local** LLM (Ollama, `qwen2.5:7b`):
   - Is it really about the company? That is the **Relevance Verdict**.
   - If so, what is its **Sentiment** toward the company?
4. Shows a dashboard covering:
   - a **Coverage Window**: the rolling 90 days, or a calendar quarter;
   - Sentiment splits;
   - a **Mention Status** per company;
   - links back to every Article.
5. Runs a **Daily Check** and raises an **Alert Digest** for **New Mentions**.
6. After every Run, writes a full export to `data/`, which is committed to the repository.

Non-goals for v1:
- authentication;
- cloud deployment;
- external alert channels such as Slack or email;
- news sources other than Google News;
- de-duplicating syndicated copies of the same story.

All of these are in [BACKLOG.md](BACKLOG.md).

Hard constraints from the brief:
- a **local** LLM through Ollama;
- Node.js. We chose **NestJS + TypeScript**; the README states this assumption;
- a README;
- a committed `data/` folder from a real run;
- a copy of the AI prompts, in `docs/ai-prompts/`.

---

## 2. Architecture

```
 browser ── http://localhost:8080 ──► frontend (nginx: static SPA, proxies /api and /health)
                                           │
                                           ▼
                        api  (node dist/main.js, port 8000)     collector  (node dist/worker.js)
                        HTTP only: reads, edits, enqueues        claims Runs, fetches news,
                        never fetches news, never calls Ollama   classifies, alerts, exports
                                   │                                  │          │         │
                                   └──────────► Postgres ◄────────────┘          │         │
                                         (source of truth + run queue)           │         │
                                                              Google News RSS ◄──┘         │
                                                     Ollama on the host (host.docker.internal:11434)
```

The diagram has five runtime components. Four of them, everything except Ollama, are Compose
services, and so is a one-off `migrate` service:

| Component | Image | Responsibility |
|---|---|---|
| `frontend` | `frontend/` (Vite build, nginx) | Serves the SPA and reverse-proxies `/api` to `api:8000`, so there is a single origin |
| `api` | backend image, `node dist/main.js` | NestJS HTTP application: read models, company admin, Run enqueueing, alerts |
| `collector` | the **same** backend image, `node dist/worker.js` | NestJS application context with no HTTP. It runs the worker loop, cron, heartbeat, Seed List import, pipeline and export |
| `postgres` | `postgres:16-alpine` | The only source of truth, and the Run queue |
| `migrate` | backend image, `npm run migration:run` | One-off job that runs before `api` and `collector` start |
| Ollama | native on the host, not in Docker | Metal GPU acceleration on macOS ([ADR-007](adr/)) |

### 2.1 Key architectural decisions

The ADRs hold the full reasoning.

- **[ADR-009](adr/) Separate api and collector, one image.**
  - The API stays responsive and never needs Ollama.
  - The collector can crash or restart without taking the dashboard down.
  - The two processes meet only in Postgres. In production the collector maps to a scheduled
    task, such as EventBridge plus an ECS task.
- **Postgres as the Run queue.**
  - The `runs` table is the queue. A partial unique index allows at most one Run that is queued or
    running.
  - The collector claims a Run with `SELECT … FOR UPDATE SKIP LOCKED`
    (`runs/repositories/postgres-run.queue.ts`).
  - There is no Redis, SQS or other broker: one Run at a time doesn't need one.
- **Ports everywhere a process boundary is crossed.**
  - Google News, Ollama, Postgres and the file system each sit behind an interface named in domain
    terms, bound to a `Symbol` injection token.
  - Each port has an in-memory implementation for tests.
  - This follows the dependency-inversion rule in `docs/coding-instructions.md`.
- **Boundary lint.**
  - dependency-cruiser fails CI if anything reachable from `api.module.ts` imports the collector-only
    modules:
    - `news/`
    - `classification/`
    - `pipeline/`
    - `companies/import/`
    - the alert notifiers
    - `runs/worker/`
  - It runs as part of `npm run lint`.

---

## 3. Backend (`backend/src/`)

### 3.1 Modules

| Module | Loaded by | Contents |
|---|---|---|
| `config/` | both | Typed config factory (`configuration.ts`) and a class-validator env schema (`validation.ts`). A bad env fails the boot |
| `database/` | both | TypeORM data source, entities and migrations |
| `domain/` | both | Pure value objects and rules: Coverage Window maths, Mention Status buckets, seed-line parser, Sentiment, Run states |
| `companies/` | both | `TrackedCompanyRepository` port with its Postgres implementation, the service, and `AdminCompaniesController` |
| `companies/import/` | collector | Seed List import, plus rule-based and Ollama ambiguity triage |
| `news/` | collector | `NewsSource` port; the Google News RSS implementation with its parser, request throttle, SSRF-safe URL checks and publisher-URL resolver |
| `classification/` | collector | Relevance, Sentiment and AmbiguityTriage ports. Also holds the Ollama client, prompts, recorded classifiers for tests, the startup health guard and the validation tooling |
| `runs/` | both | `RunQueue` port; `RunsController` and the collector-health read (api). `worker/` (collector) holds the `RunWorker` loop, `DailyCheckScheduler` (cron) and the heartbeat |
| `pipeline/` | collector | `BackfillExecutor`, `DailyCheckExecutor` and the shared `CompanyCollectionService` |
| `coverage/` | api | `CoverageReadModel` for the dashboard: summary, company rows, detail, weekly series, candidates |
| `alerts/` | both | `AlertsController` (api). `notifiers/` (collector) holds the digest builder, log notifier and file notifier |
| `data-export/` | collector / CLI | `DataExporter`, which writes the JSON/CSV export, and the `import-data` snapshot importer |
| `health/` | api | `GET /health` |

There are two composition roots:
- `api.module.ts`, started from `main.ts` through `configure-api-app.ts`, which sets the global
  ValidationPipe, the `/api` prefix and the shutdown hooks;
- `collector.module.ts`, started from `worker.ts`.

### 3.2 Ports

| Token | Interface (abridged) | Production implementation |
|---|---|---|
| `NEWS_SOURCE` | `findCandidates(profile, window: DateRange, edition) → {articles, capped}`; throws `NewsSourceUnavailable` | `GoogleNewsRssNewsSource` |
| `RELEVANCE_CLASSIFIER` | `judge(profile, article) → {relevant, reason}` | `OllamaRelevanceClassifier` |
| `SENTIMENT_CLASSIFIER` | `classify(profile, article) → {sentiment, reason}` | `OllamaSentimentClassifier` |
| `AMBIGUITY_TRIAGE` | `assess(name) → {ambiguous, reason}` | `OllamaAmbiguityTriage`, combined with rules |
| `CLASSIFIER_HEALTH` | Checks Ollama is reachable and the model is listed (`/api/tags`) | `OllamaClassifierHealth` |
| `TRACKED_COMPANY_REPOSITORY` | list / get / create / update / setStatus / recordCoverageCapped | Postgres |
| `CANDIDATE_REPOSITORY` | recordFound / pendingFor / recordRejection / recordMention / discardCompany | Postgres |
| `RUN_QUEUE` | enqueue (throws `RunAlreadyActive`) / claimNext / reportProgress / finish / interruptRunning | Postgres |
| `RUN_EXECUTORS` (multi) | `{runType; execute(run, progress, signal: AbortSignal) → RunOutcome}`; may throw `RunInterrupted` | Backfill, Daily Check |
| `ALERT_DIGEST_BUILDER` | `buildForRun(runId) → AlertDigest \| null` | `NewMentionAlertDigestBuilder` |
| `ALERT_NOTIFIERS` (multi) | `notify(digest)` | log notifier; file notifier (`data/alerts/`) |
| `DATA_EXPORTER` | `exportAll()`; throws `DataExportFailed` | JSON + CSV writer |
| `COVERAGE_READ_MODEL` | Summary, company coverage, detail, weekly series, candidate slices | Postgres (SQL aggregates) |

Errors are domain classes. Transport errors never leak: controllers map domain errors to Nest
`HttpException`s. For example, `RunAlreadyActive` becomes a 409 whose body includes the active Run.

### 3.3 Data model

The schema is in `database/migrations/` and `database/entities/`:

| Table | Purpose / key rules |
|---|---|
| `tracked_companies` | Identity column `id`. `source_name` is null for companies added by hand and is never editable. The profile fields are `display_name`, `aliases[]`, `domain`, `description` and `search_terms[]`. `status` is `active` / `needs_review` / `deactivated`. Also `review_reason`, and `coverage_capped`, which means the last collection hit the source's or the config's cap. A partial unique index on `lower(display_name)` covers non-deactivated rows |
| `articles` | One row per Google News article (ADR-008), keyed by `google_article_id`, unique. Columns: title, snippet, outlet, Google URL, resolved `publisher_url`, `published_at`, language, edition |
| `candidates` | One row per (Article, company), unique, so one Article can be a Candidate for several companies. `relevance` is `pending` / `relevant` / `rejected`. `relevance_method` is `llm` or `name_absent`. Also the reasons and the sentiment, plus `fetched_in_run_id`, `confirmed_in_run_id` and `confirmed_at`. **A Mention is a Candidate with `relevance = 'relevant'`** |
| `runs` | `type` is `backfill` or `daily_check`. `status` is `queued` → `running` → `completed` / `completed_with_errors` / `failed` / `interrupted`. Also `params` (jsonb: `until`, `companyIds`, `reprocess`), `trigger` (`dashboard` or `schedule`), `progress` (jsonb) and `error` |
| `run_company_errors` | Per-company errors within a Run, with `stage` (collection / relevance / sentiment) and `message` |
| `alert_digests`, `alert_digest_items` | One digest per Daily Check Run that found New Mentions, plus `acknowledged_at` |
| `collector_heartbeat` | A single row: `last_seen_at`, `state` (idle / importing / running), `ollama_ok`, `ollama_model`, `detail` |

**Re-process** deletes a company's Candidates and its now-orphaned Articles, then enqueues a Backfill
for that company only. Deactivating a company keeps its history (ADR-010). A re-added company gets a
new `id`.

### 3.4 Configuration

The keys are validated at boot in `config/validation.ts`. The README has the full table with
defaults. The ones that affect behaviour:

| Key | Default | Effect |
|---|---|---|
| `OLLAMA_MODEL` | `qwen2.5:7b` | Model used by all three prompts. The collector refuses to boot if it isn't pulled |
| `OLLAMA_NUM_PARALLEL` | `2` | Classification calls in flight at once. It must match Ollama's own setting |
| `OLLAMA_FAILURE_THRESHOLD` | `5` | Consecutive `ClassifierUnavailable` errors after which the Run ends `failed` |
| `NEWS_EDITIONS` | `en-US,he-IL` | Google News editions, each searched separately |
| `MAX_CANDIDATES_PER_COMPANY` | unset | Optional cap on Candidates kept per company per collection |
| `DAILY_CHECK_SCHEDULE_ENABLED` / `DAILY_CHECK_CRON` | `true` / `0 7 * * *` | In-process cron in the collector. It enqueues, and never runs a check inline |
| `NEW_MENTION_MAX_AGE_DAYS` | `7` | A Mention older than this never alerts |
| `TZ` | `Asia/Jerusalem` | Quarter boundaries, cron and Mention Status day counts |
| `RUN_POLL_INTERVAL_MS` | `3000` | How often the collector polls the queue |
| `DATA_EXPORT_DIR`, `SEED_LIST_PATH` | `../data`, `../docs/ourcrowd_companies.txt` | Overridden to the container mounts in Compose |

---

## 4. Collector runtime

### 4.1 Boot sequence (`collector-lifecycle.service.ts`)

1. **Classifier health guard.** The collector calls Ollama's `/api/tags`. If Ollama is unreachable or
   the model is missing, the process exits with the fix in the log. The API stays up, and the
   dashboard shows the collector as offline.
2. **Seed List import**, which runs only if the companies table holds fewer rows than the Seed List.
   It is resumable: an Ollama outage pauses it, and the next start continues.
   - For each line, the importer parses the name and runs triage, in two stages:
     1. **Rules:** a name of 3 characters or fewer, or a common English word or first name, is
        ambiguous.
     2. **Ollama:** the model is asked whether a search for the exact name would mostly return
        unrelated results.
   - A name either stage flags as ambiguous becomes `needs_review`, and the triage reason is
     stored. Otherwise it becomes `active`.
   - Result on the real list: about 150 active and about 110 needing review.
3. **Heartbeat** every few seconds. It reports state and Ollama health.
4. **Worker loop:** poll, `claimNext()`, dispatch to the `RunExecutor` matching the Run's type,
   report progress and `finish()`.
5. **Cron:** when enabled, enqueues a Daily Check. If a Run is already active, `RunAlreadyActive`
   is logged and skipped.

**Shutdown.** On SIGTERM the AbortSignal fires. The executor finishes the company it is working on,
then throws `RunInterrupted`, and the Run is marked `interrupted`. Anything not yet classified stays
`pending`, so the next Run resumes there. On boot, `interruptRunning()` also cleans up Runs left
`running` by a crash.

### 4.2 The pipeline (`pipeline/company-collection.service.ts`)

Both executors share one routine and process companies **one after another**. For each company:

1. **Fetch.** For each edition, `NewsSource.findCandidates(profile, window, edition)`.
   - Google News RSS search uses the company's Search Terms and the window as `after:`/`before:`.
   - It returns at most about 100 items per query (ADR-001). Hitting that cap sets `capped`.
   - Requests are throttled at 300 ms. Google redirect URLs are resolved to publisher URLs, and
     unsafe URLs are rejected.
   - `NewsSourceUnavailable` is recorded as a company error, and the Run carries on.
2. **Select and store.** De-duplicate by Google article ID, keep the in-window results and apply the
   optional cap. Then `recordFound`, which upserts Articles and creates Candidates as `pending`,
   and record `coverage_capped`.
3. **Classify the pending Candidates**, `OLLAMA_NUM_PARALLEL` at a time. For each Candidate:
   - **Name check.** If neither the title nor the snippet contains the company name or an alias,
     the Candidate is rejected with method `name_absent`. This is free and costs no LLM call.
   - **Relevance**, with the Ollama relevance prompt. A verdict of "not relevant" rejects the
     Candidate with method `llm` and keeps the model's reason.
   - **Sentiment**, run only for relevant Candidates (ADR-002). It records the Mention with
     `confirmed_in_run_id` set to this Run.
   - **Failures:**
     - `ClassifierOutputInvalid`, an unreadable answer even after one retry, leaves the Candidate
       `pending` and is reported as a Run error.
     - `ClassifierUnavailable` (transport or timeout) also counts toward the failure streak.
     - When the streak reaches the threshold, no new calls start. Calls already in flight finish,
       and the Run ends `failed`.
4. Progress after each step, written into `runs.progress` and polled by the UI.

**Backfill.**
- Window: the rolling 90 days, up to an optional `until` cutoff.
- Scope: all active companies, or `companyIds`.
- With `reprocess`, it first discards the companies' collected data.
- It **never alerts.**
- The cutoff exists so that a Daily Check after a Backfill finds genuine New Mentions. This is the
  "quick path" in the README.

**Daily Check.**
- Window: from the start of the last successful Daily Check minus one day of overlap. On the first
  run it reaches 7 days back.
- At the end it calls `AlertDigestBuilder.buildForRun(runId)`. The digest holds the Mentions with
  `confirmed_in_run_id = this run` and `published_at` within `NEW_MENTION_MAX_AGE_DAYS`, grouped by
  company, negatives first (ADR-004).
- It then calls every `AlertNotifier`: a log line and `data/alerts/<date>-run<id>.json`. The database
  row is what the dashboard shows.
- What counts is **confirmation**, not the first fetch. A Candidate left pending by a failed Run
  still alerts when a later Daily Check confirms it.

**After every Run:** `DataExporter.exportAll()` rewrites `data/` atomically, with `manifest.json`
written last.

### 4.3 LLM integration (`classification/ollama/`, `classification/prompts/`)

- **Transport.**
  - `POST /api/chat` with `stream: false` and `options.temperature: 0`.
  - `format` is a **JSON Schema**, so Ollama's structured output constrains the reply.
  - Timeout: 120 s per call.
  - A `ConcurrencyLimiter` (FIFO semaphore) caps requests in flight at `OLLAMA_NUM_PARALLEL`.
- **Prompts.** There are three: relevance, sentiment and ambiguity.
  - Each is a versioned constant (`RELEVANCE_PROMPT_VERSION = 'relevance-v1'`, and so on) with
    shared rules in `prompt-parts.ts`.
  - The system prompt defines the task and includes few-shot examples. For example, for the company
    Harvey, "Hurricane Harvey" is not relevant.
  - The user message carries the Company Profile (name, aliases, domain, description) and the
    Article (title, snippet, outlet, date).
  - Hebrew input is accepted, and the answer is always English JSON.
- **Validation of the output.** The reply is parsed field by field (reason 1–300 characters). A
  malformed reply is retried once, then becomes `ClassifierOutputInvalid`. A verdict is never
  guessed.
- **Measured quality and latency** (#18, [validation-report.md](validation-report.md)):
  - Over 60 hand-labelled real Candidates, relevance precision is 85.7% and recall is 82.8%.
  - For ambiguous names, recall drops to 66.7%: the model is conservative.
  - Sentiment accuracy is 79.3%.
  - About 5.5 s per call (median) on an M3, one call at a time.
  - A full Backfill is estimated at about 9 h sequentially.

---

## 5. HTTP API

All routes are under `/api`, except `GET /health`. The request DTOs use class-validator with
`whitelist` and `forbidNonWhitelisted`, so unknown fields are a 400. The TypeScript mirror of the
API is `frontend/src/types.ts`.

| Endpoint | Purpose |
|---|---|
| `GET /api/summary?window=` | Summary strip: companies per Mention Status, Mentions, Sentiment split, negative count |
| `GET /api/companies?window=&status=&hasNegatives=&q=&sort=` | Overview rows. Default sort: negatives in window, then recency |
| `GET /api/companies/:id?window=` | Detail: profile, Mention Status, weekly series by Sentiment, rejection rate |
| `GET /api/companies/:id/candidates?window=&include=mentions\|rejected\|all` | Paginated Candidates with verdicts and links |
| `GET/POST /api/admin/companies`, `PATCH /api/admin/companies/:id` | Manage companies. `sourceName` is read-only and gives a 400 if sent |
| `POST /api/admin/companies/:id/{review,needs-review,deactivate,reprocess}` | Status transitions. `reprocess` returns 202, or 409 if a Run is active |
| `POST /api/runs` `{type, until?, companyIds?}` | Enqueue a Backfill or Daily Check. Returns 202, or 409 with the active Run |
| `GET /api/runs`, `GET /api/runs/active` | History and live progress |
| `GET /api/collector/health` | Heartbeat: online/offline, state, Ollama ok, model |
| `GET /api/alerts?acknowledged=`, `GET /api/alerts/:id`, `POST /api/alerts/:id/acknowledge` | Alert Digests |

`window` is `rolling90`, the default, or a quarter such as `2026-Q3`. A quarter in progress means
the quarter to date.

**Mention Status** is computed at read time from the latest Mention and is independent of the
window:

| Status | Last Mention |
|---|---|
| Active | 7 days ago or less |
| Recent | 8–30 days ago |
| Quiet | more than 30 days ago |
| No coverage | no Mention ever |

---

## 6. Frontend (`frontend/src/`)

- **Stack:** Vite, React 19 and TypeScript, using functional components only, React Router 7 and
  Recharts 3.
- **Server state:** TanStack Query, with one hook per endpoint in `queries.ts`.
  - Mutations invalidate the query keys they affect.
  - `refetchInterval` drives the live Run progress, collector health and the alert bell.
  - Pages never call `fetch` directly. `api.ts` is the typed client.
- **UI state:** the Coverage Window, filters and selection live in the URL or component state.
- **Pages:**
  - `/` Overview: window selector, summary strip, company table, and a detail panel with a weekly
    chart and the Mentions or rejected Candidates.
  - `/companies`: company admin and the review gate.
  - `/operations`: start a Backfill or Daily Check, collector and Ollama health, live progress,
    Run history with per-company errors.
  - The alert bell and digest toasts appear on every page.
- **Pure logic lives outside components**, for example `coverageWindow.ts`, `overviewFilters.ts`,
  `alertDigests.ts` and `runs.ts`, and is unit-tested.

---

## 7. Data export and snapshot (ADR-005)

- **Postgres is the source of truth.** `data/` is an export of it, not a cache or a second store.
- **Files:**
  - `manifest.json` with the schema version and counts;
  - `companies.json`, `articles.json`, `candidates.json`, `runs.json`, `alert-digests.json` and
    `mention-status.json`;
  - `mentions.csv`;
  - `alerts/`.
- **`npm run import-data`** loads a committed snapshot into an **empty** database, for development
  and presentation only. Stop the collector first, so that its Seed List import doesn't populate
  the table. The README gives the exact sequence.

---

## 8. Quality and delivery

- **Tests:**
  - Jest unit specs sit beside the code: about 900 backend tests, with services built directly on
    in-memory ports.
  - e2e specs in `backend/test/` boot the real modules against Postgres, about 150 tests.
  - Vitest and Testing Library cover the frontend.
  - `npm run test:live` checks for drift against real Google News and Ollama, outside CI.
- **Real data only** ([ADR-006](adr/)):
  - Test fixtures are recorded real RSS responses and real Ollama verdicts
    (`backend/test/fixtures/`).
  - The running system never uses fake data.
  - e2e specs that boot the collector use `createCollectorContext()`, which stubs health, triage and
    the Seed List, so CI never calls Ollama.
- **CI** (`.github/workflows/ci.yml`), for each app:
  - lint, including the boundary check, with `--max-warnings 0`;
  - type-check;
  - unit and e2e tests against a Postgres service container;
  - build and Docker image builds.
  - A skipped test fails the build, and `pipefail` is set.
- **Claude review** (`claude-review.yml`) runs an automated review on every PR.
- **Workflow:**
  - one branch and worktree per issue;
  - a mandatory feedback loop on each PR;
  - only the owner merges.
  - See [CLAUDE.md](../CLAUDE.md).
- **Local orchestration:** `scripts/*.mjs` behind `npm run setup` / `start` / `stop` / `dev` /
  `import-data`.
  - Checks prerequisites and ports, and makes sure Ollama is serving and the model is pulled.
  - Runs `docker compose up --build`, and waits for health.

---

## 9. Known limitations and risks

| Area | Limitation | Mitigation / next step |
|---|---|---|
| News coverage | Google News RSS is unofficial and returns about 100 items per query. Heavily covered companies are sampled, not counted exhaustively | The `capped` flag is shown in the UI. More `NewsSource` implementations can be added (BACKLOG) |
| Recall on ambiguous names | 66.7% on the validation set | Better profiles (description, domain, Search Terms) through the review gate; prompt iteration |
| Throughput | About 9 h for a full sequential Backfill on a laptop | `OLLAMA_NUM_PARALLEL`, `MAX_CANDIDATES_PER_COMPANY`; a larger GPU in production |
| Syndication | The same story at different Outlets counts as different Mentions | BACKLOG: group syndicated Articles |
| Security | No authentication, and no Origin/CSRF check on mutating endpoints. Everything is bound to `127.0.0.1` | BACKLOG: session-cookie auth spec; follow-up: Origin check |
| Concurrency edge cases | Status transitions are a read followed by a write, not atomic | Follow-up: an atomic repository method |
| Single collector | One Run at a time by design | Enough for the volume. SKIP LOCKED already allows a second collector |

The follow-ups not yet filed as issues are listed in [STATUS.md](STATUS.md).

---

## 10. Onboarding checklist

1. Read CONTEXT.md, then ADR-001 to ADR-010, in about 30 minutes.
2. Run `npm run setup && npm start`. Port 5432 is busy if a native Postgres is running; use
   `POSTGRES_HOST_PORT=5433`.
3. In `/companies`, review a few Needs Review companies. In `/operations`, run a Backfill of about 5
   companies up to 3 days ago, then a Daily Check, and watch an Alert Digest appear.
4. Read `pipeline/company-collection.service.ts`, `runs/worker/run-worker.service.ts` and
   `classification/prompts/relevance.prompt.ts`. Together they are the core of the system.
5. Run `cd backend && npm test && npm run test:e2e` against your own Postgres.
6. Check [STATUS.md](STATUS.md) for open work: #20, the full real run and the snapshot.
