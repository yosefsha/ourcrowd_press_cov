# Backlog

Future work deliberately left out of the current scope.

## Preview search on the company page

A "Preview search" button that runs a company's Search Terms against the News Source and shows the first results without classifying or saving, to tune terms before re-processing. Must execute in the collector (as a short queued job), not the API, to keep the boundary in ADR-009.

## Immediate alert for negative Mentions

Raise an alert as soon as a negative Mention is classified, instead of waiting for the next Alert Digest. Digests stay for everything else. See [ADR-004](adr/ADR-004-alerts-as-dashboard-digests.md).

## Session-cookie authentication

The current version has no access control — it is a local tool on `localhost`. When auth is added, it uses a server-side session behind a cookie that is `HttpOnly`, `SameSite=Strict`, `Path=/`, has no `Domain` attribute, and is `Secure` whenever served over https (configurable only so plain-http local runs on older Safari work). The cookie stays first-party because the browser only ever talks to the frontend origin, which proxies `/api` to the backend; Nest runs with `trust proxy` enabled so it sees the original scheme. State-changing endpoints additionally reject a mismatched `Origin` header. The scope (shared admin login vs. real users and roles) is decided when the item is picked up.

## CLI invocation of Runs

Add `npm run backfill -- --until=3d --companies=...` and `npm run check` so Runs can be started from a terminal or a plain scheduler without the dashboard. Both call the same application service the API uses; the one-Run-at-a-time lock applies unchanged.

## Production scheduling via EventBridge

Trigger the Daily Check from an EventBridge schedule in the deployed environment (cloud deployment is currently out of scope). Calls the same Run-trigger seam the dashboard uses.

## Group syndicated Articles into stories

Cluster copies of the same story across Outlets (fuzzy title matching or embeddings via Ollama) so the dashboard can show "1 story, 30 outlets" instead of 30 Mentions. See [ADR-008](adr/ADR-008-article-identity-and-mention-per-company.md).

## Cross-source Article de-duplication

When a second News Source is added, match the same Article across sources by resolved publisher URL. Requires publisher-URL resolution to succeed reliably. See [ADR-008](adr/ADR-008-article-identity-and-mention-per-company.md).

## External alert channels

Add Slack (incoming webhook) and/or email implementations of the `AlertNotifier` port, so alerts reach people who are not looking at the dashboard. See [ADR-004](adr/ADR-004-alerts-as-dashboard-digests.md).
