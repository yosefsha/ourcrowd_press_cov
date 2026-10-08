import type { CompanyProfile } from '../../domain/company';
import type { DateRange } from '../../domain/date-range';
import type { NewsEdition } from '../../domain/news-edition';

/**
 * The only host this module ever sends a request to. Every outgoing URL is
 * built here from this constant — never taken from a feed — so publisher URL
 * resolution cannot be steered at an arbitrary server (no SSRF).
 */
export const GOOGLE_NEWS_HOST = 'news.google.com';
const GOOGLE_NEWS_ORIGIN = `https://${GOOGLE_NEWS_HOST}`;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Google article ID: the URL-safe base64 token of a `news.google.com/rss/articles/…` link. */
export const GOOGLE_ARTICLE_ID_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

/** The `hl`, `gl` and `ceid` parameters that select a Google News edition. */
export interface EditionParameters {
  readonly hl: string;
  readonly gl: string;
  readonly ceid: string;
}

/**
 * Google News edition parameters: `en-US` → `hl=en-US&gl=US&ceid=US:en`,
 * `he-IL` → `hl=he&gl=IL&ceid=IL:he`. English editions are regional in Google
 * News (`en-US`, `en-GB`, `en-IL`…), so their `hl` keeps the country; other
 * languages use the bare language code.
 */
export function editionParameters(edition: NewsEdition): EditionParameters {
  return {
    hl: edition.language === 'en' ? `${edition.language}-${edition.country}` : edition.language,
    gl: edition.country,
    ceid: `${edition.country}:${edition.language}`,
  };
}

function quote(phrase: string): string {
  return `"${phrase.replace(/"/g, '').replace(/\s+/g, ' ').trim()}"`;
}

function distinctNonBlank(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed !== '' && trimmed !== '""' && !seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

/** One alternative of an OR group: wrapped in parentheses when it is more than one token. */
function asAlternative(term: string): string {
  const isSinglePhrase = /^"[^"]*"$/.test(term) || !/\s/.test(term);
  return isSinglePhrase ? term : `(${term})`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The search terms for a company: its curated Search Terms verbatim when it
 * has any (they may carry operators, e.g. `"Harvey" AI legal`), otherwise its
 * quoted display name and each quoted alias.
 */
export function searchTermsFor(profile: CompanyProfile): readonly string[] {
  const curated = distinctNonBlank(profile.searchTerms);
  if (curated.length > 0) {
    return curated;
  }
  const names = distinctNonBlank([profile.displayName, ...profile.aliases].map(quote));
  if (names.length === 0) {
    throw new RangeError('A company profile needs a display name, an alias or a search term');
  }
  return names;
}

/**
 * The Google News query for a company and a publication window. The terms are
 * OR-ed, and the window is widened by one day on each side because `after:`
 * and `before:` are whole days in an unspecified time zone; the source filters
 * the results back to the exact window.
 */
export function buildSearchQuery(profile: CompanyProfile, window: DateRange): string {
  if (!(window.from.getTime() < window.to.getTime())) {
    throw new RangeError('The search window must end after it starts');
  }
  const terms = searchTermsFor(profile);
  const [only] = terms;
  const expression =
    terms.length === 1 && only !== undefined ? only : `(${terms.map(asAlternative).join(' OR ')})`;
  const after = isoDate(new Date(window.from.getTime() - DAY_MS));
  const before = isoDate(new Date(window.to.getTime() + DAY_MS));
  return `${expression} after:${after} before:${before}`;
}

/** The RSS search URL for a query in one edition. */
export function buildSearchUrl(query: string, edition: NewsEdition): URL {
  const url = new URL('/rss/search', GOOGLE_NEWS_ORIGIN);
  const { hl, gl, ceid } = editionParameters(edition);
  url.searchParams.set('q', query);
  url.searchParams.set('hl', hl);
  url.searchParams.set('gl', gl);
  url.searchParams.set('ceid', ceid);
  return url;
}

/** The Google News page of one article, which carries the signature needed to decode it. */
export function buildArticlePageUrl(googleArticleId: string, edition: NewsEdition): URL {
  if (!GOOGLE_ARTICLE_ID_PATTERN.test(googleArticleId)) {
    throw new RangeError(`Not a Google article ID: ${googleArticleId}`);
  }
  const url = new URL(`/rss/articles/${googleArticleId}`, GOOGLE_NEWS_ORIGIN);
  const { hl, gl, ceid } = editionParameters(edition);
  url.searchParams.set('hl', hl);
  url.searchParams.set('gl', gl);
  url.searchParams.set('ceid', ceid);
  return url;
}

/** The endpoint the Google News web app uses to decode an article ID into its publisher URL. */
export function buildDecodeEndpointUrl(): URL {
  return new URL('/_/DotsSplashUi/data/batchexecute', GOOGLE_NEWS_ORIGIN);
}

/**
 * The Google article ID in a `https://news.google.com/rss/articles/<id>` link,
 * or null when the link is not one.
 */
export function extractGoogleArticleId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== GOOGLE_NEWS_HOST) {
    return null;
  }
  const match = /^\/(?:rss\/)?articles\/([^/]+)$/.exec(url.pathname);
  const id = match?.[1];
  return id !== undefined && GOOGLE_ARTICLE_ID_PATTERN.test(id) ? id : null;
}
