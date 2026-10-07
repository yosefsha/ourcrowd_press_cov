import type { ApiClient } from '../api.ts';
import type { AdminCompany, Run } from '../types.ts';

/**
 * An in-memory ApiClient for hook tests. Every endpoint the test did not
 * provide fails loudly, so a hook calling the wrong endpoint cannot pass.
 */
export function createFakeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  const unexpected = (name: string) => (): Promise<never> =>
    Promise.reject(new Error(`Unexpected call to ApiClient.${name}`));
  return {
    getSummary: unexpected('getSummary'),
    listCompanies: unexpected('listCompanies'),
    getCompany: unexpected('getCompany'),
    listCompanyCandidates: unexpected('listCompanyCandidates'),
    listAdminCompanies: unexpected('listAdminCompanies'),
    createCompany: unexpected('createCompany'),
    updateCompany: unexpected('updateCompany'),
    markCompanyReviewed: unexpected('markCompanyReviewed'),
    sendCompanyToReview: unexpected('sendCompanyToReview'),
    deactivateCompany: unexpected('deactivateCompany'),
    reprocessCompany: unexpected('reprocessCompany'),
    enqueueRun: unexpected('enqueueRun'),
    listRuns: unexpected('listRuns'),
    getActiveRun: unexpected('getActiveRun'),
    getCollectorHealth: unexpected('getCollectorHealth'),
    listAlerts: unexpected('listAlerts'),
    getAlert: unexpected('getAlert'),
    acknowledgeAlert: unexpected('acknowledgeAlert'),
    ...overrides,
  };
}

export function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 7,
    type: 'daily_check',
    status: 'running',
    trigger: 'dashboard',
    params: { until: null, companyIds: null, reprocess: false },
    progress: null,
    error: null,
    createdAt: '2026-10-07T07:00:00.000Z',
    startedAt: '2026-10-07T07:00:02.000Z',
    finishedAt: null,
    ...overrides,
  };
}

export function buildAdminCompany(overrides: Partial<AdminCompany> = {}): AdminCompany {
  return {
    id: 42,
    sourceName: null,
    displayName: 'Example Co',
    aliases: [],
    domain: null,
    description: null,
    searchTerms: [],
    status: 'active',
    reviewReason: null,
    coverageCapped: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}
