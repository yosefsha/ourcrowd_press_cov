# Article identity is the Google article ID; a Mention is per (Article, Tracked Company)

An Article from Google News is identified by its Google article ID (the `CBMi…` token in its `news.google.com/rss/articles/…` link), not by the publisher URL. Since 2024 those links resolve only through a JavaScript redirect, and resolving them server-side depends on an undocumented Google endpoint; the ID is stable and always present. The publisher URL is resolved best-effort and preferred as the outbound link when found; otherwise the Google link is stored, which still opens the Article in a browser.

A Mention is keyed by (Article, Tracked Company), because Sentiment is judged toward a company and one Article can be positive for one Tracked Company and negative for another. Syndicated copies of a story at different Outlets are separate Articles and separate Mentions, matching how press coverage is counted ("covered by 30 outlets").

## Consequences

- De-duplicating across News Sources will require the resolved publisher URL; Articles where resolution failed cannot be matched across sources.
- Mention counts include syndicated copies; grouping them into one story is a backlog item.
