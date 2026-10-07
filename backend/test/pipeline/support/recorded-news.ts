import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FoundArticle } from '../../../src/domain/article';
import type { CompanyProfile } from '../../../src/domain/company';
import type { DateRange } from '../../../src/domain/date-range';
import type { NewsEdition } from '../../../src/domain/news-edition';
import { type NewsSearchResult, type NewsSource, NewsSourceUnavailable } from '../../../src/news/news-source';

interface RecordedArticle extends Omit<FoundArticle, 'publishedAt'> {
  readonly publishedAt: string;
}

interface RecordedResponse {
  readonly company: string;
  readonly edition: string;
  readonly query: string;
  readonly articles: readonly RecordedArticle[];
}

const FIXTURE = join(__dirname, '..', 'fixtures', 'google-news-recorded.json');

/**
 * Real Google News RSS search results (recorded 2026-10-07, parsed into the
 * `FoundArticle` shape), keyed by company display name and edition code.
 */
export function loadRecordedResponses(): ReadonlyMap<string, readonly FoundArticle[]> {
  const parsed = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { responses: RecordedResponse[] };
  return new Map(
    parsed.responses.map((response) => [
      responseKey(response.company, response.edition),
      response.articles.map((article) => ({ ...article, publishedAt: new Date(article.publishedAt) })),
    ]),
  );
}

export function responseKey(company: string, edition: string): string {
  return `${company}|${edition}`;
}

/** The recorded Article with this title (titles are unique within the fixture). */
export function recordedArticle(title: string): FoundArticle {
  for (const articles of loadRecordedResponses().values()) {
    const found = articles.find((article) => article.title === title);
    if (found !== undefined) return found;
  }
  throw new Error(`No recorded Article titled "${title}"`);
}

/**
 * An in-memory `NewsSource` replaying the recorded responses. Like the real
 * source it answers only with Articles published inside the window — unless
 * `ignoreWindow` is set, to prove the pipeline enforces the window itself.
 */
export class RecordedNewsSource implements NewsSource {
  readonly calls: { company: string; edition: string; window: DateRange }[] = [];
  private readonly responses = new Map(loadRecordedResponses());
  private readonly unavailable = new Set<string>();
  private readonly capped = new Set<string>();

  constructor(private readonly options: { ignoreWindow?: boolean } = {}) {}

  /** Serves another edition's recording under `edition` too (same Google article IDs, ADR-008). */
  replay(company: string, fromEdition: string, asEdition: string): this {
    this.responses.set(responseKey(company, asEdition), this.responses.get(responseKey(company, fromEdition)) ?? []);
    return this;
  }

  failFor(company: string, edition: string): this {
    this.unavailable.add(responseKey(company, edition));
    return this;
  }

  capFor(company: string, edition: string): this {
    this.capped.add(responseKey(company, edition));
    return this;
  }

  findCandidates(company: CompanyProfile, window: DateRange, edition: NewsEdition): Promise<NewsSearchResult> {
    const key = responseKey(company.displayName, edition.code);
    this.calls.push({ company: company.displayName, edition: edition.code, window });
    if (this.unavailable.has(key)) {
      return Promise.reject(new NewsSourceUnavailable('Google News answered 503 Service Unavailable'));
    }
    const articles = (this.responses.get(key) ?? []).filter(
      (article) =>
        this.options.ignoreWindow === true ||
        (article.publishedAt >= window.from && article.publishedAt < window.to),
    );
    return Promise.resolve({ articles, capped: this.capped.has(key) });
  }
}
