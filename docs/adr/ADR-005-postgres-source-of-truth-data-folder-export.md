# Postgres is the source of truth; the data folder is a complete export

All Candidates, Relevance Verdicts, Mentions, Sentiments, Alert Digests and run history live in Postgres, which the dashboard, the Daily Check and de-duplication read from. The `data/` folder required by the brief is a complete, versioned (`schemaVersion`) export written after every Backfill and Daily Check — including rejected Candidates with their reasons, first-seen timestamps and digest acknowledgement state — so reviewers can inspect results, and the classification-quality evidence, without running anything.

## Reading the export back — softened, for dev and presentation only

The export was originally one-way. That restriction is softened: `npm run import-data` may load `data/` into an **empty** database, solely so a developer or reviewer can see the full dashboard from a committed real run without waiting hours for a Backfill. It is not a sync, backup or migration mechanism: it refuses to run against a database that already holds data, never merges, and the dashboard then shows the snapshot's "as of" date. In normal operation nothing reads `data/`.

## Considered Options

- **Files only** — the brief allows it, but de-duplication, "first seen" tracking for alerts, unacknowledged-alert state and Coverage Window queries all become hand-rolled indexing over JSON.
- **SQLite** — no container needed, but the project template, CI and deploy pipeline are built on Postgres and TypeORM migrations.
- **Committed `pg_dump` for restoring** — no import code, but opaque in review, coupled to the Postgres version and migration level, and a second artifact of the same run that can drift from `data/`. The domain-shaped JSON export survives schema changes.

## Consequences

- The export must stay lossless with respect to what the dashboard and alerting need; a field added to the schema but not to the export silently disappears from an imported snapshot. A round-trip test (export → import into empty DB → export) guards this.
- An imported snapshot ages: the rolling Coverage Window moves on while the data does not.
