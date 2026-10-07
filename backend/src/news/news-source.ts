import type { FoundArticle } from '../domain/article';
import type { CompanyProfile } from '../domain/company';
import type { DateRange } from '../domain/date-range';
import type { NewsEdition } from '../domain/news-edition';

/** Injection token for the `NewsSource` port. */
export const NEWS_SOURCE = Symbol('NEWS_SOURCE');

/** What one search returned, and whether the source stopped at its result cap. */
export interface NewsSearchResult {
  readonly articles: readonly FoundArticle[];
  /** True when the source returned as many results as it ever does, so some may be missing. */
  readonly capped: boolean;
}

/**
 * A provider that, given a Tracked Company, returns Candidates about it — one
 * News Edition and one publication period at a time (ADR-001).
 */
export interface NewsSource {
  /**
   * Articles published within `window` that the source finds for the company's
   * Search Terms in `edition`. Throws `NewsSourceUnavailable` when the source
   * cannot be reached or answers with something it cannot parse.
   */
  findCandidates(
    company: CompanyProfile,
    window: DateRange,
    edition: NewsEdition,
  ): Promise<NewsSearchResult>;
}

/** The News Source could not be reached, or its answer could not be read. */
export class NewsSourceUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NewsSourceUnavailable';
  }
}
