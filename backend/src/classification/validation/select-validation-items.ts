import type { FoundArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { DateRange } from '../../domain/date-range';
import { namesCompany } from './names-company';
import type { NameKind, ValidationItem } from './validation-set';

/** One recorded feed and how many of its Candidates go into the set. */
export interface FeedSelection {
  /** The recorded feed, relative to `test/fixtures/`, e.g. `google-news/harvey.en-US.xml`. */
  readonly sourceFeed: string;
  readonly nameKind: NameKind;
  readonly pick: number;
  /** The profile and window the feed was searched for. */
  readonly profile: CompanyProfile;
  readonly window: DateRange;
  /** The feed's articles in feed order, as the News Source parses them. */
  readonly articles: readonly FoundArticle[];
}

/** What a selection produced, and which feeds could not supply all they were asked for. */
export interface SelectionResult {
  readonly items: readonly ValidationItem[];
  readonly shortfalls: readonly { readonly sourceFeed: string; readonly wanted: number; readonly eligible: number }[];
}

/**
 * `count` items spread evenly over `items` (first, then every n/count-th), so
 * a selection samples the whole feed rather than only Google's top results.
 * Returns every item when there are no more than `count`.
 */
export function pickEvenly<T>(items: readonly T[], count: number): T[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`Cannot pick ${count} items`);
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, index) => items[Math.floor((index * items.length) / count)]);
}

function slug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Picks the validation items from recorded feeds. Only Candidates the pipeline
 * would actually classify are eligible: published inside the feed's window and
 * passing the name check. An article already picked for the same company (e.g.
 * from its other edition) is not picked twice. Ids are `<company>-<language>-NN`.
 */
export function selectValidationItems(feeds: readonly FeedSelection[]): SelectionResult {
  const items: ValidationItem[] = [];
  const shortfalls: { sourceFeed: string; wanted: number; eligible: number }[] = [];
  const picked = new Set<string>();
  const counters = new Map<string, number>();

  for (const feed of feeds) {
    const eligible = feed.articles.filter(
      (article) =>
        article.publishedAt.getTime() >= feed.window.from.getTime() &&
        article.publishedAt.getTime() < feed.window.to.getTime() &&
        namesCompany(feed.profile, article) &&
        !picked.has(JSON.stringify([feed.profile.displayName, article.googleArticleId])),
    );
    if (eligible.length < feed.pick) {
      shortfalls.push({ sourceFeed: feed.sourceFeed, wanted: feed.pick, eligible: eligible.length });
    }
    for (const article of pickEvenly(eligible, feed.pick)) {
      picked.add(JSON.stringify([feed.profile.displayName, article.googleArticleId]));
      const prefix = `${slug(feed.profile.displayName)}-${article.language}`;
      const number = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, number);
      items.push({
        id: `${prefix}-${String(number).padStart(2, '0')}`,
        nameKind: feed.nameKind,
        sourceFeed: feed.sourceFeed,
        company: feed.profile,
        article: {
          title: article.title,
          snippet: article.snippet,
          outlet: article.outletName,
          publishedAt: article.publishedAt,
          url: article.googleUrl,
          edition: article.edition,
          language: article.language,
        },
      });
    }
  }
  return { items, shortfalls };
}
