/**
 * PLACEHOLDER FIXTURES — test-only, never imported by the running app.
 *
 * The Coverage read API (#11) does not exist yet, so these responses could not
 * be recorded from the real API as ADR-006 requires. They are the smallest
 * shapes the Overview tests need, typed against `types.ts` and using real
 * Tracked Company names from docs/ourcrowd_companies.txt. Replace them with
 * responses recorded from `GET /api/summary` and `GET /api/companies` once #11
 * lands.
 */
import type { CompanyOverviewRow, CoverageSummary } from '../types.ts';

export function buildCoverageSummary(overrides: Partial<CoverageSummary> = {}): CoverageSummary {
  return {
    window: 'rolling90',
    from: '2026-07-09T12:00:00.000Z',
    to: '2026-10-07T12:00:00.000Z',
    asOf: '2026-10-07T07:00:00.000Z',
    collectionStartedAt: '2026-07-09T12:00:00.000Z',
    companiesByMentionStatus: { active: 2, recent: 1, quiet: 1, no_coverage: 1 },
    mentionCount: 128,
    sentiment: { positive: 70, negative: 8, neutral: 50 },
    companiesWithNegativeMentions: 2,
    ...overrides,
  };
}

export function buildCompanyRow(overrides: Partial<CompanyOverviewRow> = {}): CompanyOverviewRow {
  return {
    id: 1,
    displayName: 'ZutaCore',
    mentionStatus: 'active',
    lastMentionAt: '2026-10-04T12:00:00.000Z',
    mentionCount: 12,
    capped: false,
    sentiment: { positive: 8, negative: 1, neutral: 3 },
    latestHeadline: {
      title: 'ZutaCore placeholder headline',
      outletName: 'Placeholder Outlet',
      url: 'https://news.example.com/zutacore',
      publishedAt: '2026-10-04T12:00:00.000Z',
    },
    ...overrides,
  };
}

/** Rows in the API's default order: negative Mentions descending, then recency. */
export const overviewRows: readonly CompanyOverviewRow[] = [
  buildCompanyRow({
    id: 4,
    displayName: 'Morphisec',
    mentionStatus: 'recent',
    lastMentionAt: '2026-09-20T12:00:00.000Z',
    mentionCount: 100,
    capped: true,
    sentiment: { positive: 60, negative: 5, neutral: 35 },
    latestHeadline: {
      title: 'Morphisec placeholder headline',
      outletName: 'Placeholder Outlet',
      url: 'https://news.example.com/morphisec',
      publishedAt: '2026-09-20T12:00:00.000Z',
    },
  }),
  buildCompanyRow(),
  buildCompanyRow({
    id: 2,
    displayName: 'OncoHost',
    mentionStatus: 'quiet',
    lastMentionAt: '2026-08-15T12:00:00.000Z',
    mentionCount: 3,
    sentiment: { positive: 2, negative: 0, neutral: 1 },
    latestHeadline: null,
  }),
  buildCompanyRow({
    id: 3,
    displayName: 'Maolac',
    mentionStatus: 'no_coverage',
    lastMentionAt: null,
    mentionCount: 0,
    sentiment: { positive: 0, negative: 0, neutral: 0 },
    latestHeadline: null,
  }),
];
