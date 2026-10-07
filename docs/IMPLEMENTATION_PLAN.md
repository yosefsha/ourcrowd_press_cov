# Implementation Plan — Press Mentions Monitoring & Dashboard

Implements the brief in [TASKS.md](TASKS.md). Vocabulary is defined in [CONTEXT.md](../CONTEXT.md);
the decisions behind this plan are in [docs/adr/](adr/); deferred work is in [BACKLOG.md](BACKLOG.md).
Each issue below exists on GitHub under the matching milestone — the issue is the unit of work,
this file is the map.

## Shape of the system

```
                 ┌──────────── browser ────────────┐
                 │  React dashboard (one origin)   │
                 └───────────────┬─────────────────┘
                                 │  /            /api/*
                 ┌───────────────▼─────────────────┐
                 │ frontend container              │  static build + reverse proxy /api → api:8000
                 └───────────────┬─────────────────┘
                                 │
┌────────────────────────────────▼──┐        ┌──────────────────────────────────────┐
│ api container  (node dist/main.js)│        │ collector container (node dist/worker.js)
│ HTTP only: reads, edits, enqueues │        │ claims queued Runs, Backfill / Daily  │
│ never fetches news, never Ollama  │        │ Check, import + triage, cron, exports │
└────────────────┬──────────────────┘        └───────┬───────────────┬──────────────┘
                 │          Postgres (source of truth)│               │
                 └──────────────► postgres ◄──────────┘     Google News RSS (en-US, he-IL)
                                                                     │
                                          Ollama on the host (qwen2.5:7b) ◄── host.docker.internal
```

Both backend containers come from **one image** with different commands (ADR-009). They meet only
in Postgres: the `runs` table is the queue, `collector_heartbeat` carries collector/Ollama health.

## Backend layout (`backend/src/`)

| Path | Role | Loaded by |
|---|---|---|
| `main.ts`, `api.module.ts` | HTTP entry point and root module | api |
| `worker.ts`, `collector.module.ts` | Nest application context, no HTTP | collector |
| `config/` | typed config factory + env schema (all keys below) | both |
| `database/` | TypeORM datasource, entities, `migrations/` | both |
| `domain/` | pure value objects and rules: `Sentiment`, `CoverageWindow`, `MentionStatus`, seed-line parser | both |
| `companies/` | Tracked Companies + Company Profiles: repository port + Postgres impl, service, controller, DTOs; `import/` (seed import + triage) is collector-only | both |
| `news/` | `NewsSource` port, `repositories/google-news-rss.news-source.ts` | collector |
| `classification/` | `RelevanceClassifier`, `SentimentClassifier`, `AmbiguityTriage` ports, Ollama client and implementations | collector |
| `runs/` | `RunQueue` port + Postgres impl, `RunsController` (api), `RunWorker` + cron + heartbeat (collector) | both (split by file) |
| `pipeline/` | `RunExecutor` implementations: Backfill, Daily Check | collector |
| `coverage/` | read model for the dashboard: overview, summary, company detail, candidates | api |
| `alerts/` | `AlertDigestBuilder` (collector), `AlertNotifier` port + impls (collector), `AlertsController` (api) | both (split by file) |
| `data-export/` | `DataExporter` (collector, after every Run) and the `import-data` command | collector / CLI |

**Boundary rule (ADR-009):** nothing reachable from `api.module.ts` may import `news/`,
`classification/`, `pipeline/`, `companies/import/`, the alert notifiers or the `RunWorker`.
Enforced by a lint-stage check (dependency-cruiser or `eslint-plugin-boundaries`), so CI fails on a
violation.

## Database schema (created once, in #4)

| Table | Key columns |
|---|---|
| `tracked_companies` | `id` identity · `source_name` text null, unique when not null · `display_name` · `aliases` text[] · `domain` null · `description` null · `search_terms` text[] · `status` enum `active` / `needs_review` / `deactivated` · `review_reason` null · `coverage_capped` bool (last collection hit the News Source's result cap or `MAX_CANDIDATES_PER_COMPANY`) · timestamps. Partial unique index on `lower(display_name)` where not deactivated. |
| `articles` | `id` identity · `google_article_id` unique · `title` · `snippet` · `outlet_name` · `outlet_url` · `google_url` · `publisher_url` null · `published_at` · `language` · `edition` · `first_fetched_at` |
| `candidates` | `id` · `article_id` FK · `company_id` FK · unique (`article_id`, `company_id`) · `fetched_in_run_id` · `relevance` enum `pending` / `relevant` / `rejected` · `relevance_method` enum `llm` / `name_absent` · `relevance_reason` · `sentiment` enum null · `sentiment_reason` · `confirmed_in_run_id` null · `confirmed_at` null · classification timestamps. **A Mention is a candidate with `relevance = 'relevant'`.** |
| `runs` | `id` · `type` enum `backfill` / `daily_check` · `status` enum `queued` / `running` / `completed` / `completed_with_errors` / `failed` / `interrupted` · `params` jsonb (`until`, `companyIds`, `reprocess`) · `trigger` enum `dashboard` / `schedule` · `progress` jsonb · `error` · timestamps. Partial unique index allowing one row with status in (`queued`, `running`). |
| `run_company_errors` | `run_id` · `company_id` · `stage` · `message` |
| `alert_digests` | `id` · `run_id` unique · `created_at` · `acknowledged_at` null |
| `alert_digest_items` | `digest_id` · `candidate_id` |
| `collector_heartbeat` | single row: `last_seen_at` · `state` (`idle` / `importing` / `running`) · `ollama_ok` · `ollama_model` · `detail` |

## Ports (interfaces + injection tokens, defined in #4)

| Port | Method(s) — domain terms | Implementations |
|---|---|---|
| `NewsSource` | `findCandidates(company: CompanyProfile, window: {from, to}, edition): Promise<FoundArticle[]>`; errors `NewsSourceUnavailable` | Google News RSS (#5); in-memory with recorded fixtures |
| `RelevanceClassifier` | `judge(company, article): Promise<RelevanceVerdict>`; error `ClassifierUnavailable`, `ClassifierOutputInvalid` | Ollama (#6) |
| `SentimentClassifier` | `classify(company, article): Promise<SentimentVerdict>` | Ollama (#6) |
| `AmbiguityTriage` | `assess(name): Promise<{ambiguous, reason}>` | Ollama (#6) |
| `TrackedCompanyRepository` | list / get / create / update / setStatus | Postgres (#7) |
| `RunQueue` | `enqueue(request)` (throws `RunAlreadyActive`), `claimNext()`, `reportProgress`, `finish` | Postgres (#8) |
| `RunExecutor` | `execute(run, progress): Promise<RunOutcome>` — one per Run type | Backfill, Daily Check (#9) |
| `AlertDigestBuilder` | `buildForRun(runId): Promise<AlertDigest \| null>` — called by the Daily Check | #10 |
| `AlertNotifier` | `notify(digest): Promise<void>` | log + `data/alerts/<date>-run<id>.json` (#10); the DB row is the dashboard channel |
| `DataExporter` | `exportAll(): Promise<void>` | `data/` JSON writer (#12) |

Every port ships its in-memory implementation with its first real one; test contents are recorded
from real responses (ADR-006), never hand-written.

## Configuration keys (all added in #4)

`PORT=8000` · `DATABASE_URL` · `OLLAMA_BASE_URL=http://localhost:11434` · `OLLAMA_MODEL=qwen2.5:7b` ·
`OLLAMA_NUM_PARALLEL=2` · `NEWS_EDITIONS=en-US,he-IL` · `DAILY_CHECK_SCHEDULE_ENABLED=true` ·
`DAILY_CHECK_CRON=0 7 * * *` · `TZ=Asia/Jerusalem` · `NEW_MENTION_MAX_AGE_DAYS=7` ·
`OLLAMA_FAILURE_THRESHOLD=5` · `RUN_POLL_INTERVAL_MS=3000` · `DATA_EXPORT_DIR=../data` ·
`SEED_LIST_PATH=../docs/ourcrowd_companies.txt` · `MAX_CANDIDATES_PER_COMPANY` (unset = no cap)

## HTTP API contract (`/api` prefix; `GET /health` unprefixed)

The frontend codes against this contract from day one; its TypeScript mirror lives in
`frontend/src/types.ts` (#3). `window` is `rolling90` (default) or a quarter like `2026-Q3`.

| Method & path | Purpose | Notes |
|---|---|---|
| `GET /api/summary?window=` | Summary strip: companies per Mention Status, Mentions in window, sentiment split, negative count | |
| `GET /api/companies?window=&status=&hasNegatives=&q=&sort=` | Overview table rows: id, displayName, mentionStatus, lastMentionAt, mentionCount, capped, sentiment split, latestHeadline | default sort: negatives in window desc, then recency |
| `GET /api/companies/:id?window=` | Detail: profile, Mention Status, weekly series by sentiment, rejection rate | |
| `GET /api/companies/:id/candidates?window=&include=mentions\|rejected\|all` | Mentions (and rejected Candidates with reasons) | paginated |
| `GET /api/admin/companies?status=&q=` | Company management list including Needs Review and deactivated | |
| `POST /api/admin/companies` | Add a company (no Source Name) | DTO-validated |
| `PATCH /api/admin/companies/:id` | Edit any field except `sourceName` | 400 if `sourceName` sent |
| `POST /api/admin/companies/:id/review` | Mark reviewed → `active` | |
| `POST /api/admin/companies/:id/needs-review` | Send back to Needs Review | |
| `POST /api/admin/companies/:id/deactivate` | Deactivate (history kept) | |
| `POST /api/admin/companies/:id/reprocess` | Enqueue a single-company Backfill with `reprocess: true` | 202 / 409 |
| `POST /api/runs` `{type, until?, companyIds?}` | Enqueue Backfill or Daily Check | 202 / 409 with the active Run |
| `GET /api/runs?limit=` · `GET /api/runs/active` | Run history and live progress | polled every few seconds |
| `GET /api/collector/health` | Heartbeat: online/offline, state, Ollama ok, model | |
| `GET /api/alerts?acknowledged=false` · `GET /api/alerts/:id` · `POST /api/alerts/:id/acknowledge` | Alert Digests | |

State-changing endpoints are plain JSON POST/PATCH; auth is deferred (BACKLOG).

## Milestones, issues and dependencies

Issue numbers are the GitHub numbers. **Bold** = can start as soon as its dependencies are merged;
everything inside a wave is designed to touch disjoint files.

```
Wave 0   #2 Backend scaffold ─────────┐            #3 Frontend scaffold ──────────────┐
Wave 1   #4 Schema, ports, config, module shells ◄─┘                                  │
Wave 2   #5 News  #6 Ollama  #7 Companies  #8 Run queue  #9 Pipeline  #10 Alerts       │
         #11 Coverage read API  #12 Data export/import          (all ◄─ #4)           │
         #13 Overview UI  #14 Company detail UI  #15 Companies admin UI               │
         #16 Alerts + Operations UI                              (all ◄─ #3) ◄────────┘
Wave 3   #17 Local run orchestration (◄─ #2, #3)   #18 Classification validation (◄─ #5, #6)
Wave 4   #19 README (◄─ everything)   #20 Full real run + data/ snapshot (◄─ everything)
```

### M0 — Foundation
- **#2 Backend scaffold, two entry points, compose** — NestJS per `docs/backend-nestjs-instructions.md`; `main.ts` + `worker.ts`; health; one Dockerfile; compose with `postgres`, `migrate` (one-off), `api`, `collector`; boundary lint check wired; CI green.
- **#3 Frontend scaffold, app shell, API client** — Vite + React + TS; scripts per CI; Dockerfile serving the build and proxying `/api`; Vite dev proxy; routes `/`, `/companies`, `/operations` with empty pages; alert-bell slot; `types.ts` from the contract; typed fetch client; Recharts installed.
- **#4 Schema, domain types, ports, config and module shells** — the full migration above; entities; every port + token + error class; `domain/` value objects with tests (Coverage Window maths, Mention Status buckets, seed-line parser); all config keys; empty feature modules registered in both roots so later issues only edit their own module.

### M1 — Pipeline & API (parallel after #4)
- **#5 Google News RSS News Source** · **#6 Ollama classifiers + triage** · **#7 Tracked Companies: import, triage, admin API** · **#8 Run queue, worker loop, heartbeat, cron, runs API** · **#9 Backfill and Daily Check executors** · **#10 Alert Digests: builder, notifier, API** · **#11 Coverage read API** · **#12 Data export and import-data**

### M2 — Dashboard UI (parallel after #3)
- **#13 Overview page** · **#14 Company detail panel** · **#15 Companies management page** · **#16 Alerts and Operations**

### M3 — Delivery
- **#17 Local run orchestration** · **#18 Classification validation** · **#19 README** · **#20 Full real run and data snapshot**

## Conventions for every issue
- Branch + worktree per issue (CLAUDE.md). Never run migrations or seeds from a worktree; report instead.
- Feature issues do not add migrations unless they genuinely change the schema; if they must, a new timestamped migration file, never an edit of #4's.
- Tests: unit tests construct services with in-memory port implementations; e2e boots the real module against Postgres with ports overridden. Fixtures are recorded real data.
- Every public function typed, failure path tested; no `any`.
- PR body: `Closes #N`; never merge.
