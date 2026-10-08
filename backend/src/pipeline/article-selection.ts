import type { FoundArticle } from '../domain/article';
import type { DateRange } from '../domain/date-range';
import { isWithin } from './collection-window';

/** The Articles one company's collection keeps, and whether a cap cut any off. */
export interface ArticleSelection {
  readonly articles: readonly FoundArticle[];
  /** More Articles were found than `MAX_CANDIDATES_PER_COMPANY` allows. */
  readonly truncated: boolean;
}

/**
 * Narrows what every edition returned for one company to what is stored: each
 * Article once (the first edition that listed it wins, ADR-008), only those
 * published inside `window`, newest first, at most `max` of them.
 */
export function selectArticles(
  found: readonly FoundArticle[],
  window: DateRange,
  max: number | null,
): ArticleSelection {
  const byId = new Map<string, FoundArticle>();
  for (const article of found) {
    if (!byId.has(article.googleArticleId) && isWithin(article.publishedAt, window)) {
      byId.set(article.googleArticleId, article);
    }
  }
  const newestFirst = [...byId.values()].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
  if (max === null || newestFirst.length <= max) return { articles: newestFirst, truncated: false };
  return { articles: newestFirst.slice(0, max), truncated: true };
}
