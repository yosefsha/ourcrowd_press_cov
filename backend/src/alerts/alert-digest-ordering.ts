import type { Sentiment } from '../domain/sentiment';

/** What ordering needs to know about a New Mention. */
export interface OrderableMention {
  readonly candidateId: number;
  readonly companyId: number;
  readonly displayName: string;
  readonly sentiment: Sentiment;
}

/** Reads when a Mention's Article was published. */
export type PublishedAtOf<M> = (mention: M) => Date;

/** The New Mentions of one Tracked Company, in digest order. */
export interface OrderedCompanyGroup<M extends OrderableMention> {
  readonly companyId: number;
  readonly displayName: string;
  readonly mentions: readonly [M, ...M[]];
}

const SENTIMENT_RANK: Readonly<Record<Sentiment, number>> = { negative: 0, positive: 1, neutral: 2 };

/** Negative first, then positive, then neutral; newest first within each; candidate id breaks ties. */
export function compareMentionsNegativeFirst<M extends OrderableMention>(
  publishedAtOf: PublishedAtOf<M>,
): (a: M, b: M) => number {
  return (a, b) =>
    SENTIMENT_RANK[a.sentiment] - SENTIMENT_RANK[b.sentiment] ||
    publishedAtOf(b).getTime() - publishedAtOf(a).getTime() ||
    a.candidateId - b.candidateId;
}

function negativeCount(mentions: readonly OrderableMention[]): number {
  return mentions.filter((mention) => mention.sentiment === 'negative').length;
}

/**
 * Groups New Mentions by Tracked Company in Alert Digest order (ADR-004):
 * companies with the most negative Mentions first, so one negative story about
 * a small company is never buried under routine coverage of a large one; then
 * by Mention count and name. Within a company, negative Mentions come first.
 */
export function groupNegativeFirst<M extends OrderableMention>(
  mentions: readonly M[],
  publishedAtOf: PublishedAtOf<M>,
): readonly OrderedCompanyGroup<M>[] {
  const byCompany = new Map<number, M[]>();
  for (const mention of mentions) {
    const group = byCompany.get(mention.companyId);
    if (group === undefined) byCompany.set(mention.companyId, [mention]);
    else group.push(mention);
  }

  const groups: OrderedCompanyGroup<M>[] = [];
  for (const [companyId, companyMentions] of byCompany) {
    const [first, ...rest] = [...companyMentions].sort(compareMentionsNegativeFirst(publishedAtOf));
    groups.push({ companyId, displayName: first.displayName, mentions: [first, ...rest] });
  }

  return groups.sort(
    (a, b) =>
      negativeCount(b.mentions) - negativeCount(a.mentions) ||
      b.mentions.length - a.mentions.length ||
      a.displayName.localeCompare(b.displayName) ||
      a.companyId - b.companyId,
  );
}
