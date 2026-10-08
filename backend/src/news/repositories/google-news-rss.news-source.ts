import { Inject, Injectable } from '@nestjs/common';

import type { FoundArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { DateRange } from '../../domain/date-range';
import type { NewsEdition } from '../../domain/news-edition';
import type { ParsedGoogleNewsFeed } from '../google-news/google-news-rss-parser';
import { parseGoogleNewsRss } from '../google-news/google-news-rss-parser';
import type { GoogleNewsTransport } from '../google-news/google-news-transport';
import { GOOGLE_NEWS_TRANSPORT } from '../google-news/google-news-transport';
import { buildSearchQuery, buildSearchUrl } from '../google-news/google-news-urls';
import type { NewsSearchResult, NewsSource } from '../news-source';
import { NewsSourceUnavailable } from '../news-source';
import type { PublisherUrlResolver } from '../publisher-url-resolver';
import { PUBLISHER_URL_RESOLVER } from '../publisher-url-resolver';

/** Google News RSS returns at most this many items per search. */
export const GOOGLE_NEWS_RESULT_CAP = 100;
/** A full 100-item feed is ~130 kB; the cap only stops a runaway response. */
const FEED_MAX_BYTES = 5 * 1024 * 1024;
const FEED_TIMEOUT_MS = 15_000;
/**
 * After this many publisher URL resolutions fail in a row within one search,
 * the rest of that search skips resolution: the undocumented endpoint is most
 * likely down or changed, and every further attempt only costs time.
 */
const RESOLUTION_FAILURES_BEFORE_GIVING_UP = 3;

/**
 * `NewsSource` over Google News RSS search (ADR-001).
 *
 * Limitations (for the README):
 * - The feed is unofficial and undocumented; its format can change without
 *   notice. A response that cannot be read fails with `NewsSourceUnavailable`.
 * - Each search returns at most ~100 items (`GOOGLE_NEWS_RESULT_CAP`); a full
 *   feed is reported as `capped`, so heavily covered companies are sampled,
 *   not counted exhaustively.
 * - Item links are `news.google.com` redirect links. The Google article ID in
 *   them is the Article's identity (ADR-008); the publisher URL is resolved
 *   best-effort through an undocumented Google endpoint and is null when that
 *   fails.
 * - `after:`/`before:` are whole days, so the search is widened by a day on
 *   each side and the results are filtered back to the exact window.
 * - An Article's language is its edition's language; the feed does not say.
 */
@Injectable()
export class GoogleNewsRssNewsSource implements NewsSource {
  constructor(
    @Inject(GOOGLE_NEWS_TRANSPORT) private readonly transport: GoogleNewsTransport,
    @Inject(PUBLISHER_URL_RESOLVER) private readonly publisherUrls: PublisherUrlResolver,
  ) {}

  async findCandidates(
    company: CompanyProfile,
    window: DateRange,
    edition: NewsEdition,
  ): Promise<NewsSearchResult> {
    const url = buildSearchUrl(buildSearchQuery(company, window), edition);
    const feed = await this.search(url, company, edition);
    const inWindow = feed.articles.filter(
      (article) =>
        article.publishedAt.getTime() >= window.from.getTime() &&
        article.publishedAt.getTime() < window.to.getTime(),
    );
    return {
      articles: await this.withPublisherUrls(inWindow, edition),
      capped: feed.itemCount >= GOOGLE_NEWS_RESULT_CAP,
    };
  }

  private async search(
    url: URL,
    company: CompanyProfile,
    edition: NewsEdition,
  ): Promise<ParsedGoogleNewsFeed> {
    const what = `Google News search for "${company.displayName}" in ${edition.code}`;
    let xml: string;
    try {
      xml = await this.transport.fetchText({ url, maxBytes: FEED_MAX_BYTES, timeoutMs: FEED_TIMEOUT_MS });
    } catch (error: unknown) {
      throw new NewsSourceUnavailable(`${what} failed`, { cause: error });
    }
    try {
      return parseGoogleNewsRss(xml, edition);
    } catch (error: unknown) {
      throw new NewsSourceUnavailable(`${what} returned an unreadable response`, { cause: error });
    }
  }

  /** Resolves publisher URLs one at a time (the transport throttles), never failing an Article. */
  private async withPublisherUrls(
    articles: readonly FoundArticle[],
    edition: NewsEdition,
  ): Promise<FoundArticle[]> {
    const result: FoundArticle[] = [];
    let consecutiveFailures = 0;
    for (const article of articles) {
      if (consecutiveFailures >= RESOLUTION_FAILURES_BEFORE_GIVING_UP) {
        result.push(article);
        continue;
      }
      const publisherUrl = await this.publisherUrls.resolvePublisherUrl(
        article.googleArticleId,
        edition,
      );
      consecutiveFailures = publisherUrl === null ? consecutiveFailures + 1 : 0;
      result.push({ ...article, publisherUrl });
    }
    return result;
  }
}
