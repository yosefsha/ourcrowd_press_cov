/**
 * Pure helpers for Alert Digests: ordering (negative Mentions first, ADR-004),
 * safe outbound links and detecting digests that arrived while the app is open.
 */
import type { AlertDigestCompanyGroup, AlertDigestSummary, AlertMention, Article } from './types.ts';

const SENTIMENT_ORDER = { negative: 0, positive: 1, neutral: 2 } as const;

/** Negative Mentions first, then positive, then neutral; newest first within each. */
export function sortMentionsNegativeFirst(mentions: readonly AlertMention[]): readonly AlertMention[] {
  return [...mentions].sort(
    (a, b) =>
      SENTIMENT_ORDER[a.sentiment] - SENTIMENT_ORDER[b.sentiment] ||
      Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt),
  );
}

function negativeCount(group: AlertDigestCompanyGroup): number {
  return group.mentions.filter((mention) => mention.sentiment === 'negative').length;
}

/**
 * Companies with negative Mentions first (most negatives first), the rest
 * after, keeping the server's order otherwise — a single negative story must
 * not sink below twenty routine ones.
 */
export function orderDigestGroups(groups: readonly AlertDigestCompanyGroup[]): readonly AlertDigestCompanyGroup[] {
  return groups
    .map((group, index) => ({ group, index, negatives: negativeCount(group) }))
    .sort((a, b) => Math.sign(b.negatives) - Math.sign(a.negatives) || b.negatives - a.negatives || a.index - b.index)
    .map(({ group }) => ({ ...group, mentions: sortMentionsNegativeFirst(group.mentions) }));
}

/**
 * The link to open for an Article: the Outlet's own URL once resolved,
 * otherwise the Google News link. Only http(s) URLs are ever rendered as
 * links, so a malformed or `javascript:` value from a feed cannot run.
 */
export function articleHref(article: Pick<Article, 'publisherUrl' | 'googleUrl'>): string | null {
  for (const candidate of [article.publisherUrl, article.googleUrl]) {
    if (candidate === null) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch {
      // Not a URL — try the next candidate.
    }
  }
  return null;
}

/** Digests in `digests` whose id is not in `seen`, in the order listed. */
export function findUnseenDigests(
  seen: ReadonlySet<number>,
  digests: readonly AlertDigestSummary[],
): readonly AlertDigestSummary[] {
  return digests.filter((digest) => !seen.has(digest.id));
}

/** `5 New Mentions across 3 companies, 1 negative` */
export function describeDigest(digest: Pick<AlertDigestSummary, 'mentionCount' | 'companyCount' | 'negativeMentionCount'>): string {
  const mentions = `${digest.mentionCount} New ${digest.mentionCount === 1 ? 'Mention' : 'Mentions'}`;
  const companies = `${digest.companyCount} ${digest.companyCount === 1 ? 'company' : 'companies'}`;
  return `${mentions} across ${companies}, ${digest.negativeMentionCount} negative`;
}
