import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from './api.ts';
import { ApiClientContext } from './apiClientContext.ts';
import { ApiError, RunConflictError } from './apiErrors.ts';
import {
  queryKeys,
  useAcknowledgeAlertMutation,
  useActiveRunQuery,
  useCompanyQuery,
  useCreateCompanyMutation,
  useDeactivateCompanyMutation,
  useEnqueueRunMutation,
  useMarkCompanyReviewedMutation,
  useReprocessCompanyMutation,
  useSendCompanyToReviewMutation,
  useSummaryQuery,
  useUpdateCompanyMutation,
} from './queries.ts';
import { buildAdminCompany, buildRun, createFakeApiClient } from './test/fixtures.ts';
import type { AlertDigestSummary, CoverageSummary } from './types.ts';

function setup(overrides: Partial<ApiClient>): {
  queryClient: QueryClient;
  wrapper: (props: { children: ReactNode }) => React.JSX.Element;
  invalidatedKeys: () => QueryKey[];
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const api = createFakeApiClient(overrides);
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <ApiClientContext.Provider value={api}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientContext.Provider>
  );
  const invalidatedKeys = (): QueryKey[] =>
    invalidate.mock.calls.map(([filters]) => filters?.queryKey).filter((key): key is QueryKey => key !== undefined);
  return { queryClient, wrapper, invalidatedKeys };
}

/** Seeds a query and reports whether a mutation left it marked stale. */
function seed(queryClient: QueryClient, key: QueryKey): () => boolean {
  queryClient.setQueryData(key, { seeded: true });
  return () => queryClient.getQueryState(key)?.isInvalidated ?? false;
}

const company = buildAdminCompany();

describe('company mutations invalidate the company lists and the company detail', () => {
  async function expectCompanyCachesInvalidated(
    api: Partial<ApiClient>,
    mutate: (wrapper: ReturnType<typeof setup>['wrapper']) => Promise<void>,
  ): Promise<void> {
    const { queryClient, wrapper, invalidatedKeys } = setup(api);
    const isStale = {
      adminCompanies: seed(queryClient, queryKeys.adminCompanies({})),
      overview: seed(queryClient, queryKeys.companies({ window: 'rolling90' })),
      detail: seed(queryClient, queryKeys.companyDetail(42, 'rolling90')),
      candidates: seed(queryClient, queryKeys.companyCandidates(42, { window: 'rolling90' })),
      summary: seed(queryClient, queryKeys.summary('rolling90')),
      runs: seed(queryClient, queryKeys.runs({})),
      alerts: seed(queryClient, queryKeys.alerts({})),
    };

    await mutate(wrapper);

    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([queryKeys.adminCompaniesAll, queryKeys.companiesAll, queryKeys.summaryAll]),
    );
    expect(isStale.adminCompanies()).toBe(true);
    expect(isStale.overview()).toBe(true);
    expect(isStale.detail()).toBe(true);
    expect(isStale.candidates()).toBe(true);
    expect(isStale.summary()).toBe(true);
    expect(isStale.runs()).toBe(false);
    expect(isStale.alerts()).toBe(false);
  }

  it('create', async () => {
    const createCompany = vi.fn().mockResolvedValue(company);
    await expectCompanyCachesInvalidated({ createCompany }, async (wrapper) => {
      const { result } = renderHook(() => useCreateCompanyMutation(), { wrapper });
      act(() => {
        result.current.mutate({ displayName: 'Example Co' });
      });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
    expect(createCompany).toHaveBeenCalledWith({ displayName: 'Example Co' });
  });

  it('update', async () => {
    const updateCompany = vi.fn().mockResolvedValue(company);
    await expectCompanyCachesInvalidated({ updateCompany }, async (wrapper) => {
      const { result } = renderHook(() => useUpdateCompanyMutation(), { wrapper });
      act(() => {
        result.current.mutate({ id: 42, changes: { displayName: 'Renamed' } });
      });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
    expect(updateCompany).toHaveBeenCalledWith(42, { displayName: 'Renamed' });
  });

  it.each([
    ['review', 'markCompanyReviewed', useMarkCompanyReviewedMutation],
    ['needs-review', 'sendCompanyToReview', useSendCompanyToReviewMutation],
    ['deactivate', 'deactivateCompany', useDeactivateCompanyMutation],
  ] as const)('%s', async (_name, method, hook) => {
    const call = vi.fn().mockResolvedValue(company);
    const { queryClient, wrapper } = setup({ [method]: call });
    const detailStale = seed(queryClient, queryKeys.companyDetail(42, '2026-Q3'));
    const adminStale = seed(queryClient, queryKeys.adminCompanies({ status: 'needs_review' }));
    const { result } = renderHook(() => hook(), { wrapper });

    act(() => {
      result.current.mutate(42);
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(call).toHaveBeenCalledWith(42);
    expect(detailStale()).toBe(true);
    expect(adminStale()).toBe(true);
  });

  it('invalidates nothing when the change is rejected', async () => {
    const { queryClient, wrapper, invalidatedKeys } = setup({
      updateCompany: vi.fn().mockRejectedValue(new ApiError(400, 'property sourceName should not exist', null)),
    });
    const adminStale = seed(queryClient, queryKeys.adminCompanies({}));
    const { result } = renderHook(() => useUpdateCompanyMutation(), { wrapper });

    act(() => {
      result.current.mutate({ id: 42, changes: { displayName: '' } });
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toMatchObject({ status: 400 });
    expect(invalidatedKeys()).toEqual([]);
    expect(adminStale()).toBe(false);
  });
});

describe('enqueueing a Run', () => {
  interface EnqueueCase {
    readonly method: 'enqueueRun' | 'reprocessCompany';
    readonly expectedArgs: readonly unknown[];
    readonly useEnqueue: () => { readonly start: () => void; readonly isSuccess: boolean };
  }

  it.each<[string, EnqueueCase]>([
    [
      'POST /api/runs',
      {
        method: 'enqueueRun',
        expectedArgs: [{ type: 'daily_check' }],
        useEnqueue: () => {
          const mutation = useEnqueueRunMutation();
          return { start: () => { mutation.mutate({ type: 'daily_check' }); }, isSuccess: mutation.isSuccess };
        },
      },
    ],
    [
      'reprocess',
      {
        method: 'reprocessCompany',
        expectedArgs: [42],
        useEnqueue: () => {
          const mutation = useReprocessCompanyMutation();
          return { start: () => { mutation.mutate(42); }, isSuccess: mutation.isSuccess };
        },
      },
    ],
  ])('%s invalidates runs on success', async (_name, { method, expectedArgs, useEnqueue }) => {
    const call = vi.fn().mockResolvedValue(buildRun({ status: 'queued' }));
    const { queryClient, wrapper } = setup({ [method]: call });
    const historyStale = seed(queryClient, queryKeys.runs({ limit: 20 }));
    const activeStale = seed(queryClient, queryKeys.activeRun);
    const companiesStale = seed(queryClient, queryKeys.companies({ window: 'rolling90' }));
    const { result } = renderHook(useEnqueue, { wrapper });

    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(call).toHaveBeenCalledWith(...expectedArgs);
    expect(historyStale()).toBe(true);
    expect(activeStale()).toBe(true);
    expect(companiesStale()).toBe(false);
  });

  it('puts the active Run from a 409 straight into the cache', async () => {
    const activeRun = buildRun({ id: 11, type: 'backfill' });
    const { queryClient, wrapper } = setup({
      enqueueRun: vi.fn().mockRejectedValue(new RunConflictError('A Run is already active', null, activeRun)),
    });
    const historyStale = seed(queryClient, queryKeys.runs({}));
    const { result } = renderHook(() => useEnqueueRunMutation(), { wrapper });

    act(() => {
      result.current.mutate({ type: 'daily_check' });
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(RunConflictError);
    expect(queryClient.getQueryData(queryKeys.activeRun)).toEqual(activeRun);
    expect(historyStale()).toBe(true);
  });

  it('leaves the cache alone on other failures', async () => {
    const { queryClient, wrapper, invalidatedKeys } = setup({
      reprocessCompany: vi.fn().mockRejectedValue(new ApiError(404, 'Tracked Company 42 not found', null)),
    });
    const { result } = renderHook(() => useReprocessCompanyMutation(), { wrapper });

    act(() => {
      result.current.mutate(42);
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidatedKeys()).toEqual([]);
    expect(queryClient.getQueryData(queryKeys.activeRun)).toBeUndefined();
  });
});

describe('acknowledging an Alert Digest', () => {
  it('invalidates every alerts query', async () => {
    const acknowledged: AlertDigestSummary = {
      id: 3,
      runId: 7,
      createdAt: '2026-10-07T07:10:00.000Z',
      acknowledgedAt: '2026-10-07T08:00:00.000Z',
      mentionCount: 4,
      companyCount: 2,
      negativeMentionCount: 1,
    };
    const { queryClient, wrapper } = setup({ acknowledgeAlert: vi.fn().mockResolvedValue(acknowledged) });
    const listStale = seed(queryClient, queryKeys.alerts({ acknowledged: false }));
    const detailStale = seed(queryClient, queryKeys.alert(3));
    const runsStale = seed(queryClient, queryKeys.runs({}));
    const { result } = renderHook(() => useAcknowledgeAlertMutation(), { wrapper });

    act(() => {
      result.current.mutate(3);
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(listStale()).toBe(true);
    expect(detailStale()).toBe(true);
    expect(runsStale()).toBe(false);
  });
});

describe('queries', () => {
  it('fetches the summary for the given Coverage Window', async () => {
    const summary: CoverageSummary = {
      window: '2026-Q3',
      from: '2026-07-01T00:00:00.000+03:00',
      to: '2026-10-01T00:00:00.000+03:00',
      asOf: null,
      companiesByMentionStatus: { active: 0, recent: 0, quiet: 0, no_coverage: 0 },
      mentionCount: 0,
      sentiment: { positive: 0, negative: 0, neutral: 0 },
      companiesWithNegativeMentions: 0,
    };
    const getSummary = vi.fn().mockResolvedValue(summary);
    const { queryClient, wrapper } = setup({ getSummary });
    const { result } = renderHook(() => useSummaryQuery('2026-Q3'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(getSummary).toHaveBeenCalledWith({ window: '2026-Q3' });
    expect(queryClient.getQueryData(queryKeys.summary('2026-Q3'))).toEqual(summary);
  });

  it('surfaces an ApiError from the client as the query error', async () => {
    const { wrapper } = setup({
      getSummary: vi.fn().mockRejectedValue(new ApiError(503, 'Service Unavailable', null)),
    });
    const { result } = renderHook(() => useSummaryQuery('rolling90'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ status: 503 });
  });

  it('does not fetch company detail until a company is selected', async () => {
    const getCompany = vi.fn().mockResolvedValue({});
    const { wrapper } = setup({ getCompany });
    const { result, rerender } = renderHook(({ id }: { id: number | null }) => useCompanyQuery(id, 'rolling90'), {
      wrapper,
      initialProps: { id: null as number | null },
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCompany).not.toHaveBeenCalled();

    rerender({ id: 42 });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(getCompany).toHaveBeenCalledWith(42, { window: 'rolling90' });
  });

  it('polls the active Run', async () => {
    const getActiveRun = vi.fn().mockResolvedValue(null);
    const { wrapper } = setup({ getActiveRun });
    renderHook(() => useActiveRunQuery({ refetchInterval: 20 }), { wrapper });

    await waitFor(() => {
      expect(getActiveRun.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});
