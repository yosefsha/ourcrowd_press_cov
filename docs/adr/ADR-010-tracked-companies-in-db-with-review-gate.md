# Tracked Companies live in the database, behind a review gate

Supersedes ADR-003. The database is the source of truth for Tracked Companies and their Company Profiles, edited through a dedicated dashboard page; `ourcrowd_companies.txt` is only a starter, imported once into an empty table. Each Tracked Company has a database-generated integer id, because every human-facing field — display name included — is editable. The one read-only field is the **source name**, the raw seed-list line; companies added on the page have no source name, which marks them as not from the OurCrowd list. Display name, "formerly" alias and domain are pre-filled by parsing the seed line and editable like everything else. Profile fields are validated server-side.

## Review gate

At import the collector triages every company: a rule set (single common English word or first name from a bundled word list, or ≤ 3 characters) and a one-off Ollama question ("would a news search for this exact name mostly return unrelated articles?" → `{ ambiguous, reason }`, flagging on any doubt). A company flagged by either starts as **Needs review** and is excluded from Runs until a person reviews its profile on the company page; the rest are collected immediately. Some companies therefore have no coverage at first — accepted. Unlike the LLM-written descriptions rejected in ADR-003, the model here only raises a flag a person resolves, and errs toward a review rather than toward wrong data. As a safety net the dashboard surfaces companies with a high relevance-rejection rate, and any company can be sent back to Needs review.

## Lifecycle

- **Deactivate, never delete.** A deactivated company is excluded from Runs and the dashboard; its Candidates and Mentions are kept for audit. Re-adding the company creates a new Tracked Company with a new id.
- **Re-process company** deletes that company's Candidates, Relevance Verdicts and Mentions and queues a Backfill limited to it — a fresh search and classification with the current profile. History is replaced, not versioned, and, being a Backfill, it never alerts. Offered after editing a profile and after completing a review.
- Profile edits affect future Runs only until the company is re-processed.

## Considered Options

- **Curated seed file reviewed in a pull request** — rejected: review belongs in the product, next to the data it affects.
- **Ambiguity by rules only** — misses rare words common in news and flags harmless names. **Probe search** (classify sample results per company) — most accurate, but ~2,500 LLM calls before anything starts.
- **Profile versions recorded on Mentions** — rejected in favour of replacing history on re-process.
