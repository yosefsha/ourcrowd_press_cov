# Collector runs separately from the API; Runs are queued in Postgres

The backend has two entry points built into one image and deployed as two containers, one process each: `api` (`node dist/main.js`, HTTP only) and `collector` (`node dist/worker.js`, no HTTP), which executes Backfills and Daily Checks and owns the flag-controlled daily cron (`DAILY_CHECK_SCHEDULE_ENABLED`, `DAILY_CHECK_CRON`). The API never fetches news or calls Ollama — its module graph does not import the News Source or classifier modules, and a lint rule enforces that boundary. They coordinate only through Postgres: the API inserts a Run with status `queued` (returning 202, or 409 while another Run is queued or running, enforced by a partial unique index); the collector claims it with `SELECT … FOR UPDATE SKIP LOCKED`, writes progress to the Run row, and records a heartbeat with its Ollama health that the dashboard displays.

## Considered Options

- **Two processes in one container** — rejected: needs a supervisor, hides one process's crash behind the other, and prevents independent restart and scaling.
- **Separate image per role** (Dockerfile targets) — two images to build and push for near-identical dependencies; one image also guarantees both roles run the same code against the same schema.
- **Separate `collector/` package** — duplicates domain types and entities or forces a shared package, and adds a third service to CI.
- **Redis + BullMQ** — a new service in docker-compose and CI for a queue that holds at most one job.
- **pg-boss** — a reasonable Postgres-backed queue, but a library and its own schema for what the Runs table, needed anyway for the lock, progress and history, already provides.

## Consequences

- Only the collector requires Ollama at boot (refines ADR-007); the API and dashboard stay up when Ollama is down and report it from the heartbeat.
- Enqueueing sits behind a `RunQueue` port, so moving to SQS or an EventBridge-launched ECS task later replaces one adapter.
- A Run is picked up within the collector's polling interval (a few seconds), not instantly.
