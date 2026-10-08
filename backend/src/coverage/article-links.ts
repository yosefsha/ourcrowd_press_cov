import type { CoverageArticle } from './coverage-read-model';

/** `url` when it is an absolute http(s) URL, else null — nothing else is ever sent to the browser. */
export function safeHttpUrl(url: string | null): string | null {
  if (url === null) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** Where a headline links: the Outlet's own URL when known, else the Google News URL. */
export function articleLink(article: Pick<CoverageArticle, 'publisherUrl' | 'googleUrl'>): string | null {
  return safeHttpUrl(article.publisherUrl) ?? safeHttpUrl(article.googleUrl);
}
