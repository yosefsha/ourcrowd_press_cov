# Google News RSS search as the first News Source, behind a port

Candidates are fetched through a `NewsSource` port named in domain terms ("news items about this Tracked Company in this window"), and the first implementation is Google News RSS search. It is the only free, keyless option that covers a full quarter and returns a snippet the classifiers can read, so a reviewer can run the project with nothing but Ollama installed. NewsAPI, a scraper or GDELT are added later as new implementations without editing the code that consumes the port.

## Considered Options

- **GDELT DOC 2.0** — free and official with real article URLs, but titles only (no snippet) and noisy, non-English-heavy results.
- **NewsAPI.org** — free tier reaches back only one month and is licensed for development only, so it cannot satisfy the quarterly view.
- **Scraping company press pages** — yields a company's own announcements, not press coverage.

## Consequences

- Google News RSS is unofficial and undocumented; its format can change without notice.
- Each query returns at most ~100 items, so heavily covered companies (SpaceX, Stripe, Anthropic) are sampled, not exhaustively counted. The window is deliberately not split into time slices to get past this cap — that would multiply Candidates (and LLM time) for exactly those companies — so their ~100 items may also cluster in time rather than spread across the quarter.
- Searches run against configurable Google News editions (`NEWS_EDITIONS`, default `en-US,he-IL`): many portfolio companies are Israeli and much of their coverage appears only in the Hebrew press. Each edition is a separate query, so Candidates roughly double, and classifier prompts accept Hebrew input while always answering in English JSON. A story and its translation are different Articles.
- Item links are Google redirect URLs and must be resolved to the publisher URL before storage and de-duplication.
