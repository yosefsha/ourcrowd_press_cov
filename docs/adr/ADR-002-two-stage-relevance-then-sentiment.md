# Relevance and sentiment are separate classification steps

Every Candidate is first judged by a `RelevanceClassifier` ("is this article about this Tracked Company?"); only a Candidate judged relevant becomes a Mention and is passed to a `SentimentClassifier` ("is this article positive, negative or neutral toward the company?"). Both run on the local Ollama model, each article is classified at most once per step, and the relevance verdict is stored with its reason so rejected Candidates remain auditable.

## Considered Options

- **One combined prompt returning `{ relevant, sentiment }`** — one call per Candidate instead of up to two, but the two answers are coupled: tuning one shifts the other, and their quality cannot be measured independently. The saving is small because sentiment is skipped entirely for rejected Candidates, which are numerous for ambiguous names (Harvey, Wave, Ro, Island…).

## Consequences

- Classification quality is validated per step: relevance precision and sentiment accuracy are reported separately.
- Each step can be swapped to a different model or prompt independently.
- Rejected Candidates are persisted, not dropped, so the daily run never re-classifies an article it has already seen.
