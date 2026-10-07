# Alerts are per-run digests shown in the dashboard

Each Daily Check that finds new Mentions produces one Alert Digest, stored in the database and surfaced as a notification in the dashboard until acknowledged; it is also written to the log and to `data/alerts/<date>.json`. A digest groups the new Mentions by Tracked Company with negative Mentions first, because a reader scanning a morning summary must not have one negative story about a small company buried under twenty routine SpaceX items. Delivery goes through an `AlertNotifier` port so other channels can be added without touching the Daily Check.

## Rules

- A Mention is **new** when it is first confirmed as a Mention in this Daily Check — not when it was published (Google News often surfaces articles a day or two late) and not when it was first fetched (a Candidate left unclassified because Ollama was down must still alert once a later Run confirms it).
- A Mention first seen today but published more than **7 days** ago is stored and shown but does not alert; it is no longer news.
- The **Backfill never alerts**, or the first run would raise thousands of "new" Mentions.
- A Daily Check with no new Mentions produces no digest, only a log line.

## Considered Options

- **One alert per Mention** — noisy for heavily covered companies; deferred as an immediate alert for negative Mentions only (see backlog).
- **Slack webhook / email** — deferred. Email needs SMTP credentials a reviewer would have to supply; the dashboard is visible with no setup.
