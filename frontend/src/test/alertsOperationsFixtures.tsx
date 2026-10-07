/**
 * Test-only fixtures for the alert bell and the Operations page.
 *
 * PROVISIONAL: the runs, collector-health and alerts endpoints (#8, #10) do not
 * exist yet, so these responses cannot be recorded from the real API. They are
 * minimal shapes typed against `types.ts`, using real Tracked Company names
 * from docs/ourcrowd_companies.txt, and must be replaced by responses recorded
 * from the real API once #8 and #10 land (ADR-006). Nothing here is imported by
 * application code.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { ApiClient } from '../api.ts';
import { ApiClientContext } from '../apiClientContext.ts';
import type {
  AdminCompany,
  AlertDigest,
  AlertDigestSummary,
  AlertMention,
  CollectorHealth,
  Run,
  RunProgress,
} from '../types.ts';
import { buildAdminCompany, buildRun, createFakeApiClient } from './fixtures.ts';

export function renderWithApi(
  ui: ReactNode,
  overrides: Partial<ApiClient>,
): RenderResult & { readonly queryClient: QueryClient; readonly api: ApiClient } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const api = createFakeApiClient(overrides);
  const result = render(
    <ApiClientContext.Provider value={api}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </ApiClientContext.Provider>,
  );
  return { ...result, queryClient, api };
}

// ---------------------------------------------------------------------------
// Runs and collector health
// ---------------------------------------------------------------------------

export function buildProgress(overrides: Partial<RunProgress> = {}): RunProgress {
  return {
    companiesTotal: 40,
    companiesDone: 12,
    candidatesFound: 310,
    candidatesClassified: 118,
    mentionsConfirmed: 64,
    companyErrors: 0,
    currentCompany: 'Morphisec',
    ...overrides,
  };
}

export const runningBackfill: Run = buildRun({
  id: 3,
  type: 'backfill',
  status: 'running',
  params: { until: '2026-10-04', companyIds: null, reprocess: false },
  progress: buildProgress(),
  createdAt: '2026-10-07T06:00:00.000Z',
  startedAt: '2026-10-07T06:00:03.000Z',
});

export const completedBackfill: Run = buildRun({
  id: 3,
  type: 'backfill',
  status: 'completed',
  params: { until: '2026-10-04', companyIds: null, reprocess: false },
  progress: buildProgress({ companiesDone: 40, candidatesClassified: 310, currentCompany: null }),
  createdAt: '2026-10-07T06:00:00.000Z',
  startedAt: '2026-10-07T06:00:03.000Z',
  finishedAt: '2026-10-07T06:41:15.000Z',
});

export const dailyCheckWithErrors: Run = buildRun({
  id: 5,
  type: 'daily_check',
  status: 'completed_with_errors',
  trigger: 'schedule',
  progress: buildProgress({
    companiesDone: 40,
    candidatesFound: 22,
    candidatesClassified: 22,
    mentionsConfirmed: 9,
    companyErrors: 2,
    currentCompany: null,
  }),
  createdAt: '2026-10-08T07:00:00.000Z',
  startedAt: '2026-10-08T07:00:02.000Z',
  finishedAt: '2026-10-08T07:03:30.000Z',
});

export const failedDailyCheck: Run = buildRun({
  id: 6,
  type: 'daily_check',
  status: 'failed',
  progress: null,
  error: 'Ollama did not answer within 60s',
  createdAt: '2026-10-09T07:00:00.000Z',
  startedAt: '2026-10-09T07:00:02.000Z',
  finishedAt: '2026-10-09T07:01:02.000Z',
});

export const healthyCollector: CollectorHealth = {
  online: true,
  lastSeenAt: '2026-10-07T06:10:00.000Z',
  state: 'idle',
  ollamaOk: true,
  ollamaModel: 'qwen2.5:7b-instruct',
  detail: null,
};

export const activeCompanies: readonly AdminCompany[] = [
  buildAdminCompany({ id: 1, sourceName: 'ZutaCore', displayName: 'ZutaCore' }),
  buildAdminCompany({ id: 4, sourceName: 'OncoHost', displayName: 'OncoHost' }),
  buildAdminCompany({ id: 5, sourceName: 'Morphisec', displayName: 'Morphisec' }),
];

// ---------------------------------------------------------------------------
// Alert Digests
// ---------------------------------------------------------------------------

function mention(candidateId: number, sentiment: AlertMention['sentiment'], title: string, outletName: string): AlertMention {
  return {
    candidateId,
    sentiment,
    article: {
      id: candidateId + 1000,
      title,
      snippet: '',
      outletName,
      outletUrl: 'https://www.calcalistech.com',
      googleUrl: `https://news.google.com/rss/articles/fixture-${candidateId}`,
      publisherUrl: `https://www.calcalistech.com/ctechnews/article/fixture-${candidateId}`,
      publishedAt: '2026-10-08T05:00:00.000Z',
      language: 'en',
      edition: 'en-US',
    },
  };
}

export const digestSummary: AlertDigestSummary = {
  id: 11,
  runId: 5,
  createdAt: '2026-10-08T07:03:31.000Z',
  acknowledgedAt: null,
  mentionCount: 3,
  companyCount: 2,
  negativeMentionCount: 1,
};

export const digestDetail: AlertDigest = {
  ...digestSummary,
  // Deliberately listed positive-first: the panel must still put negatives first.
  companies: [
    {
      companyId: 1,
      displayName: 'ZutaCore',
      mentions: [mention(201, 'positive', 'ZutaCore expands liquid cooling partnership', 'Calcalist')],
    },
    {
      companyId: 4,
      displayName: 'OncoHost',
      mentions: [
        mention(202, 'neutral', 'OncoHost presents data at ESMO', 'Globes'),
        mention(203, 'negative', 'OncoHost trims workforce', 'Calcalist'),
      ],
    },
  ],
};

export const laterDigestSummary: AlertDigestSummary = {
  id: 12,
  runId: 7,
  createdAt: '2026-10-09T07:02:00.000Z',
  acknowledgedAt: null,
  mentionCount: 1,
  companyCount: 1,
  negativeMentionCount: 0,
};
