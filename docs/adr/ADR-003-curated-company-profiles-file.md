---
status: superseded by ADR-010
---

# Company Profiles are hand-curated in a file beside the seed list

The seed list (`ourcrowd_companies.txt`) stays the single source of truth for *which* companies are tracked; a hand-curated `companies.json` enriches entries with optional aliases (including "formerly X" names), domain, a one-line description and search terms. The seed list is names only and many names are ordinary words, so without this context neither the search nor the RelevanceClassifier can tell Harvey the legal-AI company from Hurricane Harvey. Startup fails if `companies.json` names a company absent from the seed list; a company with no profile falls back to its quoted name.

## Considered Options

- **LLM-generated descriptions** — automatic, but an LLM confidently invents descriptions for obscure or defunct startups, and those errors would silently steer relevance decisions.
- **Profiles stored in the database with an editing API** — deferred, not rejected. The file is versioned, reviewable in a pull request, and enough for a fixed seed list.

Superseded: profiles and the company list itself moved into the database with an editing page, and the seed list became a starter only — see ADR-010.
