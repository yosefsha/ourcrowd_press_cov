import type { CompanySort } from './dto/companies-query.dto';

/** What an overview row is ordered by. */
export interface OrderableCompany {
  readonly displayName: string;
  readonly lastMentionAt: Date | null;
  readonly mentionCount: number;
  readonly negativeCount: number;
}

type Comparator = (a: OrderableCompany, b: OrderableCompany) => number;

const byName: Comparator = (a, b) =>
  a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' });

/** Most recent Mention first; companies never mentioned last. */
const byRecency: Comparator = (a, b) =>
  (b.lastMentionAt?.getTime() ?? Number.NEGATIVE_INFINITY) -
  (a.lastMentionAt?.getTime() ?? Number.NEGATIVE_INFINITY) || 0;

const byNegatives: Comparator = (a, b) => b.negativeCount - a.negativeCount;
const byMentions: Comparator = (a, b) => b.mentionCount - a.mentionCount;

function chain(...comparators: Comparator[]): Comparator {
  return (a, b) => {
    for (const compare of comparators) {
      const order = compare(a, b);
      if (order !== 0) return order;
    }
    return 0;
  };
}

/** Each sort order, ending in the display name so the order is total. */
const COMPARATORS: Readonly<Record<CompanySort, Comparator>> = {
  negatives: chain(byNegatives, byRecency, byName),
  recency: chain(byRecency, byName),
  mentions: chain(byMentions, byRecency, byName),
  name: byName,
};

/** A sorted copy of `companies`. */
export function orderCompanies<T extends OrderableCompany>(companies: readonly T[], sort: CompanySort): T[] {
  return [...companies].sort(COMPARATORS[sort]);
}
