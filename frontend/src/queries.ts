/**
 * TanStack Query hooks — one per endpoint of the HTTP API contract.
 *
 * Pages read and change server state only through these hooks: never through
 * `api.ts` or `fetch` directly, and never with `useEffect` data fetching.
 * Mutations invalidate exactly the query keys whose data they change.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { RunConflictError } from './apiErrors.ts';
import { useApiClient } from './apiClientContext.ts';
import type {
  AdminCompaniesQuery,
  AdminCompany,
  AlertDigest,
  AlertDigestSummary,
  AlertsQuery,
  Candidate,
  CandidatesQuery,
  CollectorHealth,
  CompaniesQuery,
  CompanyDetail,
  CompanyOverviewRow,
  CoverageSummary,
  CoverageWindow,
  CreateCompanyRequest,
  EnqueueRunRequest,
  Page,
  Run,
  RunsQuery,
  UpdateCompanyRequest,
} from './types.ts';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/**
 * Hierarchical query keys. Each `…All` / entity key is a prefix of the keys
 * below it, so invalidating it refreshes every query underneath.
 */
export const queryKeys = {
  summaryAll: ['summary'] as const,
  summary: (window: CoverageWindow) => ['summary', window] as const,

  companiesAll: ['companies'] as const,
  companies: (query: CompaniesQuery) => ['companies', 'list', query] as const,
  /** Prefix of everything about one Tracked Company on the dashboard. */
  company: (id: number) => ['companies', 'detail', id] as const,
  companyDetail: (id: number, window: CoverageWindow) => ['companies', 'detail', id, 'summary', window] as const,
  companyCandidates: (id: number, query: CandidatesQuery) =>
    ['companies', 'detail', id, 'candidates', query] as const,

  adminCompaniesAll: ['adminCompanies'] as const,
  adminCompanies: (query: AdminCompaniesQuery) => ['adminCompanies', query] as const,

  runsAll: ['runs'] as const,
  runHistoryAll: ['runs', 'list'] as const,
  runs: (query: RunsQuery) => ['runs', 'list', query] as const,
  activeRun: ['runs', 'active'] as const,

  collectorHealth: ['collector', 'health'] as const,

  alertsAll: ['alerts'] as const,
  alerts: (query: AlertsQuery) => ['alerts', 'list', query] as const,
  alert: (id: number) => ['alerts', 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

/** Live Run progress: matches the collector's poll interval (RUN_POLL_INTERVAL_MS). */
export const ACTIVE_RUN_POLL_MS = 3_000;
/** Collector heartbeat on the Operations page and in the shell. */
export const COLLECTOR_HEALTH_POLL_MS = 15_000;
/** Unacknowledged Alert Digests behind the alert bell. */
export const ALERTS_POLL_MS = 60_000;

export interface PollingOptions {
  /** Milliseconds between refetches, or `false` to stop polling. */
  readonly refetchInterval?: number | false;
}

// ---------------------------------------------------------------------------
// Coverage (dashboard read model)
// ---------------------------------------------------------------------------

export function useSummaryQuery(window: CoverageWindow): UseQueryResult<CoverageSummary> {
  const api = useApiClient();
  return useQuery({ queryKey: queryKeys.summary(window), queryFn: () => api.getSummary({ window }) });
}

export function useCompaniesQuery(query: CompaniesQuery): UseQueryResult<readonly CompanyOverviewRow[]> {
  const api = useApiClient();
  return useQuery({ queryKey: queryKeys.companies(query), queryFn: () => api.listCompanies(query) });
}

/** Detail for one Tracked Company; disabled while `id` is null (nothing selected). */
export function useCompanyQuery(id: number | null, window: CoverageWindow): UseQueryResult<CompanyDetail> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.companyDetail(id ?? -1, window),
    queryFn: () => api.getCompany(requireId(id), { window }),
    enabled: id !== null,
  });
}

/** Mentions (and optionally rejected Candidates) of one Tracked Company; disabled while `id` is null. */
export function useCompanyCandidatesQuery(
  id: number | null,
  query: CandidatesQuery,
): UseQueryResult<Page<Candidate>> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.companyCandidates(id ?? -1, query),
    queryFn: () => api.listCompanyCandidates(requireId(id), query),
    enabled: id !== null,
  });
}

// ---------------------------------------------------------------------------
// Company management
// ---------------------------------------------------------------------------

export function useAdminCompaniesQuery(query: AdminCompaniesQuery): UseQueryResult<readonly AdminCompany[]> {
  const api = useApiClient();
  return useQuery({ queryKey: queryKeys.adminCompanies(query), queryFn: () => api.listAdminCompanies(query) });
}

/** A company's profile or status changed: every list and its own detail are stale. */
async function invalidateCompany(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.adminCompaniesAll }),
    // Prefix of the overview list and of every company(id) detail and candidates query.
    queryClient.invalidateQueries({ queryKey: queryKeys.companiesAll }),
    // Counts per Mention Status include only active companies.
    queryClient.invalidateQueries({ queryKey: queryKeys.summaryAll }),
  ]);
}

export function useCreateCompanyMutation(): UseMutationResult<AdminCompany, Error, CreateCompanyRequest> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request) => api.createCompany(request),
    onSuccess: () => invalidateCompany(queryClient),
  });
}

export interface UpdateCompanyVariables {
  readonly id: number;
  readonly changes: UpdateCompanyRequest;
}

export function useUpdateCompanyMutation(): UseMutationResult<AdminCompany, Error, UpdateCompanyVariables> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }) => api.updateCompany(id, changes),
    onSuccess: () => invalidateCompany(queryClient),
  });
}

export function useMarkCompanyReviewedMutation(): UseMutationResult<AdminCompany, Error, number> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.markCompanyReviewed(id),
    onSuccess: () => invalidateCompany(queryClient),
  });
}

export function useSendCompanyToReviewMutation(): UseMutationResult<AdminCompany, Error, number> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.sendCompanyToReview(id),
    onSuccess: () => invalidateCompany(queryClient),
  });
}

export function useDeactivateCompanyMutation(): UseMutationResult<AdminCompany, Error, number> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.deactivateCompany(id),
    onSuccess: () => invalidateCompany(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/**
 * After an enqueue attempt: a new Run joins the history on success; on a 409
 * the conflict already carries the active Run, so the cache takes it at once.
 */
function runEnqueueCallbacks(queryClient: QueryClient): {
  onSuccess: () => Promise<void>;
  onError: (error: Error) => Promise<void>;
} {
  return {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.runsAll }),
    onError: async (error) => {
      if (!(error instanceof RunConflictError)) return;
      queryClient.setQueryData<Run | null>(queryKeys.activeRun, error.activeRun);
      // The history may be stale too; the active Run is already fresh, so skip it.
      await queryClient.invalidateQueries({ queryKey: queryKeys.runHistoryAll });
    },
  };
}

/** Re-process one Tracked Company. Rejects with `RunConflictError` while another Run is active. */
export function useReprocessCompanyMutation(): UseMutationResult<Run, Error, number> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.reprocessCompany(id),
    ...runEnqueueCallbacks(queryClient),
  });
}

/** Enqueue a Backfill or Daily Check. Rejects with `RunConflictError` while another Run is active. */
export function useEnqueueRunMutation(): UseMutationResult<Run, Error, EnqueueRunRequest> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request) => api.enqueueRun(request),
    ...runEnqueueCallbacks(queryClient),
  });
}

export function useRunsQuery(query: RunsQuery, options: PollingOptions = {}): UseQueryResult<readonly Run[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.runs(query),
    queryFn: () => api.listRuns(query),
    refetchInterval: options.refetchInterval ?? false,
  });
}

/** The queued or running Run (null when idle), polled for live progress. */
export function useActiveRunQuery(options: PollingOptions = {}): UseQueryResult<Run | null> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.activeRun,
    queryFn: () => api.getActiveRun(),
    refetchInterval: options.refetchInterval ?? ACTIVE_RUN_POLL_MS,
  });
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

export function useCollectorHealthQuery(options: PollingOptions = {}): UseQueryResult<CollectorHealth> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.collectorHealth,
    queryFn: () => api.getCollectorHealth(),
    refetchInterval: options.refetchInterval ?? COLLECTOR_HEALTH_POLL_MS,
  });
}

// ---------------------------------------------------------------------------
// Alert Digests
// ---------------------------------------------------------------------------

/** Alert Digests; pass `{ acknowledged: false }` for the bell, which polls by default. */
export function useAlertsQuery(
  query: AlertsQuery,
  options: PollingOptions = {},
): UseQueryResult<readonly AlertDigestSummary[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.alerts(query),
    queryFn: () => api.listAlerts(query),
    refetchInterval: options.refetchInterval ?? ALERTS_POLL_MS,
  });
}

/** One Alert Digest; disabled while `id` is null (nothing open). */
export function useAlertQuery(id: number | null): UseQueryResult<AlertDigest> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.alert(id ?? -1),
    queryFn: () => api.getAlert(requireId(id)),
    enabled: id !== null,
  });
}

export function useAcknowledgeAlertMutation(): UseMutationResult<AlertDigestSummary, Error, number> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.acknowledgeAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.alertsAll }),
  });
}

/** Guards a query function that `enabled: id !== null` already keeps from running. */
function requireId(id: number | null): number {
  if (id === null) throw new Error('Query ran without an id although it is disabled until one is set');
  return id;
}
