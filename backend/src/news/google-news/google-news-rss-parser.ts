import { XMLParser, XMLValidator } from 'fast-xml-parser';

import type { FoundArticle } from '../../domain/article';
import type { NewsEdition } from '../../domain/news-edition';
import { htmlToText } from './html-text';
import { extractGoogleArticleId } from './google-news-urls';
import { toHttpUrl } from './safe-url';

/** What one Google News RSS response contained. */
export interface ParsedGoogleNewsFeed {
  /** Usable, de-duplicated items, `publisherUrl` not yet resolved. */
  readonly articles: readonly FoundArticle[];
  /** Every `<item>` in the response, usable or not — compared against the result cap. */
  readonly itemCount: number;
}

/** The response is not a Google News RSS document this parser understands. */
export class GoogleNewsFeedUnreadable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleNewsFeedUnreadable';
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: false,
  isArray: (name, jpath) => jpath === 'rss.channel.item' && name === 'item',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The text content of an element that may also carry attributes. */
function textOf(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (isRecord(value) && typeof value['#text'] === 'string') {
    return value['#text'];
  }
  return null;
}

/** Removes the Outlet name Google appends to titles (" - Outlet") and descriptions (" Outlet"). */
function withoutTrailingOutlet(text: string, separator: string, outletName: string): string {
  const suffix = `${separator}${outletName}`;
  return text.endsWith(suffix) && text.length > suffix.length
    ? text.slice(0, -suffix.length).trim()
    : text;
}

function parseItem(item: unknown, edition: NewsEdition): FoundArticle | null {
  if (!isRecord(item)) {
    return null;
  }
  const link = textOf(item.link);
  const googleUrl = toHttpUrl(link);
  const googleArticleId = googleUrl === null ? null : extractGoogleArticleId(googleUrl);
  const source = item.source;
  const outletName = htmlToText(textOf(source) ?? '');
  const outletUrl = isRecord(source) ? toHttpUrl(source['@_url']) : null;
  const rawTitle = htmlToText(textOf(item.title) ?? '');
  const publishedAt = new Date(textOf(item.pubDate) ?? '');
  if (
    googleUrl === null ||
    googleArticleId === null ||
    outletName === '' ||
    outletUrl === null ||
    rawTitle === '' ||
    Number.isNaN(publishedAt.getTime())
  ) {
    return null;
  }
  return {
    googleArticleId,
    title: withoutTrailingOutlet(rawTitle, ' - ', outletName),
    snippet: withoutTrailingOutlet(htmlToText(textOf(item.description) ?? ''), ' ', outletName),
    outletName,
    outletUrl,
    googleUrl,
    publisherUrl: null,
    publishedAt,
    language: edition.language,
    edition: edition.code,
  };
}

/**
 * Parses a Google News RSS search response. Items missing an article ID, a
 * title, an Outlet with a web URL or a valid date are skipped, and repeated
 * article IDs are kept once. Throws `GoogleNewsFeedUnreadable` when the
 * document is not RSS, or when it has items but none of them is usable — the
 * sign of a format change rather than of an odd item.
 */
export function parseGoogleNewsRss(xml: string, edition: NewsEdition): ParsedGoogleNewsFeed {
  // Google News RSS never declares a DTD; refusing one rules out entity-expansion attacks.
  if (/<!DOCTYPE/i.test(xml)) {
    throw new GoogleNewsFeedUnreadable('The response declares a DOCTYPE');
  }
  if (XMLValidator.validate(xml) !== true) {
    throw new GoogleNewsFeedUnreadable('The response is not well-formed XML');
  }
  const document: unknown = parser.parse(xml);
  const rss = isRecord(document) ? document.rss : undefined;
  const channel = isRecord(rss) ? rss.channel : undefined;
  if (!isRecord(channel)) {
    throw new GoogleNewsFeedUnreadable('The response is not an RSS channel');
  }
  const items: readonly unknown[] = Array.isArray(channel.item) ? channel.item : [];
  const seen = new Set<string>();
  const articles: FoundArticle[] = [];
  for (const item of items) {
    const article = parseItem(item, edition);
    if (article !== null && !seen.has(article.googleArticleId)) {
      seen.add(article.googleArticleId);
      articles.push(article);
    }
  }
  if (items.length > 0 && articles.length === 0) {
    throw new GoogleNewsFeedUnreadable(`None of the ${items.length} items could be read`);
  }
  return { articles, itemCount: items.length };
}
