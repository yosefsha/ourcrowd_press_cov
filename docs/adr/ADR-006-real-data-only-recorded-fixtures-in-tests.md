# Real data only at runtime; tests use recorded real fixtures

The running system — Backfill, Daily Check, dashboard and the committed `data/` snapshot — only ever holds data fetched from real News Sources and classified by the real Ollama model: no seed scripts, no demo mode, no invented companies or articles. To see an alert immediately, the Backfill accepts an `until` cutoff (API and dashboard control) so the following Daily Check finds the most recent days as genuine New Mentions.

Automated tests replace the ports with in-memory implementations, as the backend standard requires, because CI has neither internet access to a stable feed nor an Ollama runtime. Their contents are recorded from real Google News RSS responses and real Ollama verdicts and committed as fixtures, never hand-written. An optional `npm run test:live`, outside CI, exercises real Google News and real Ollama for a few companies to detect feed-format or model-output drift.

## Considered Options

- **Demo / seed mode** — rejected: a reviewer could not tell demo output from real results.
- **Tests against live services** — rejected for CI: results change hourly and CI has no Ollama, so assertions could not be stable.
