import { COMPANY_SORTS, MENTION_STATUSES } from './types.ts';
import type { CompaniesQuery, CompanySort, CoverageWindow, MentionStatus } from './types.ts';

/**
 * The Overview page's table filters and sort order, kept in the URL query so a
 * filtered view survives reloads and can be shared as a link.
 */
export interface OverviewFilters {
  readonly status: MentionStatus | null;
  readonly hasNegatives: boolean;
  /** Name search; empty means no search. */
  readonly q: string;
  readonly sort: CompanySort;
}

/** Negative Mentions in the window descending, then recency (docs/IMPLEMENTATION_PLAN.md). */
export const DEFAULT_COMPANY_SORT: CompanySort = 'negatives';

/** URL search parameters owned by the Overview page. */
export const OVERVIEW_PARAMS = {
  status: 'status',
  hasNegatives: 'hasNegatives',
  q: 'q',
  sort: 'sort',
  company: 'company',
} as const;

/** Reads the filters from untrusted URL parameters; anything malformed reads as its default. */
export function parseOverviewFilters(params: URLSearchParams): OverviewFilters {
  return {
    status: parseMentionStatus(params.get(OVERVIEW_PARAMS.status)),
    hasNegatives: params.get(OVERVIEW_PARAMS.hasNegatives) === 'true',
    q: (params.get(OVERVIEW_PARAMS.q) ?? '').trim(),
    sort: parseCompanySort(params.get(OVERVIEW_PARAMS.sort)) ?? DEFAULT_COMPANY_SORT,
  };
}

/**
 * Applies `changes` to a copy of `current`. Defaults are removed from the URL
 * rather than spelled out, so the plain page URL is the default view. Other
 * parameters (the Coverage Window, the open company) are kept.
 */
export function writeOverviewFilters(current: URLSearchParams, changes: Partial<OverviewFilters>): URLSearchParams {
  const next = new URLSearchParams(current);
  if (changes.status !== undefined) setOrDelete(next, OVERVIEW_PARAMS.status, changes.status);
  if (changes.hasNegatives !== undefined) {
    setOrDelete(next, OVERVIEW_PARAMS.hasNegatives, changes.hasNegatives ? 'true' : null);
  }
  if (changes.q !== undefined) setOrDelete(next, OVERVIEW_PARAMS.q, changes.q.trim() === '' ? null : changes.q.trim());
  if (changes.sort !== undefined) {
    setOrDelete(next, OVERVIEW_PARAMS.sort, changes.sort === DEFAULT_COMPANY_SORT ? null : changes.sort);
  }
  return next;
}

/** The `GET /api/companies` query for a window and filters; unset filters are omitted. */
export function toCompaniesQuery(window: CoverageWindow, filters: OverviewFilters): CompaniesQuery {
  return {
    window,
    sort: filters.sort,
    ...(filters.status === null ? {} : { status: filters.status }),
    ...(filters.hasNegatives ? { hasNegatives: true } : {}),
    ...(filters.q === '' ? {} : { q: filters.q }),
  };
}

/** Whether any filter narrows the table (sort order does not). */
export function hasActiveFilters(filters: OverviewFilters): boolean {
  return filters.status !== null || filters.hasNegatives || filters.q !== '';
}

/** Parses the open company's id from the URL; null when absent or not a positive integer. */
export function parseCompanyId(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function parseMentionStatus(value: string | null): MentionStatus | null {
  return MENTION_STATUSES.find((status) => status === value) ?? null;
}

function parseCompanySort(value: string | null): CompanySort | null {
  return COMPANY_SORTS.find((sort) => sort === value) ?? null;
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null): void {
  if (value === null) params.delete(key);
  else params.set(key, value);
}
