import type { NewsEdition } from '../domain/news-edition';

/** Injection token for the `PublisherUrlResolver` seam. */
export const PUBLISHER_URL_RESOLVER = Symbol('PUBLISHER_URL_RESOLVER');

/**
 * Best-effort lookup of the Outlet's own URL behind a Google News article
 * (ADR-008). Resolution depends on an undocumented Google endpoint, so it is
 * kept behind its own seam and never fails an Article.
 */
export interface PublisherUrlResolver {
  /**
   * The publisher's `http(s)` URL for the article, or null when it could not
   * be resolved for any reason. Never throws.
   */
  resolvePublisherUrl(googleArticleId: string, edition: NewsEdition): Promise<string | null>;
}
