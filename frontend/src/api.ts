import { ApiError, InvalidResponseError, NetworkError, RunConflictError } from './apiErrors.ts';
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
  CompanyDetailQuery,
  CompanyOverviewRow,
  CoverageSummary,
  CreateCompanyRequest,
  EnqueueRunRequest,
  Page,
  Run,
  RunDetail,
  RunsQuery,
  SummaryQuery,
  UpdateCompanyRequest,
} from './types.ts';

/** The subset of `fetch` the client needs — injected so tests never touch the network. */
export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

/** One function per endpoint of the HTTP API contract (docs/IMPLEMENTATION_PLAN.md). */
export interface ApiClient {
  getSummary(query: SummaryQuery): Promise<CoverageSummary>;
  listCompanies(query: CompaniesQuery): Promise<readonly CompanyOverviewRow[]>;
  getCompany(id: number, query: CompanyDetailQuery): Promise<CompanyDetail>;
  listCompanyCandidates(id: number, query: CandidatesQuery): Promise<Page<Candidate>>;

  listAdminCompanies(query: AdminCompaniesQuery): Promise<readonly AdminCompany[]>;
  createCompany(request: CreateCompanyRequest): Promise<AdminCompany>;
  updateCompany(id: number, request: UpdateCompanyRequest): Promise<AdminCompany>;
  markCompanyReviewed(id: number): Promise<AdminCompany>;
  sendCompanyToReview(id: number): Promise<AdminCompany>;
  deactivateCompany(id: number): Promise<AdminCompany>;
  /** 202 with the queued Run; rejects with `RunConflictError` while another Run is active. */
  reprocessCompany(id: number): Promise<Run>;

  /** 202 with the queued Run; rejects with `RunConflictError` while another Run is active. */
  enqueueRun(request: EnqueueRunRequest): Promise<Run>;
  listRuns(query: RunsQuery): Promise<readonly Run[]>;
  /** The queued or running Run, or null when the queue is idle. */
  getActiveRun(): Promise<Run | null>;
  /** One Run with its per-company errors. */
  getRun(id: number): Promise<RunDetail>;

  getCollectorHealth(): Promise<CollectorHealth>;

  listAlerts(query: AlertsQuery): Promise<readonly AlertDigestSummary[]>;
  getAlert(id: number): Promise<AlertDigest>;
  acknowledgeAlert(id: number): Promise<AlertDigestSummary>;
}

type QueryValue = string | number | boolean | undefined;
type HttpMethod = 'GET' | 'POST' | 'PATCH';

interface RequestOptions {
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly body?: unknown;
  /** The endpoint may answer 2xx with no body (e.g. 204); it then resolves to null. */
  readonly allowEmpty?: boolean;
}

const API_BASE_PATH = '/api';

export function createApiClient(
  fetchFn: FetchFn = (input, init) => fetch(input, init),
  basePath: string = API_BASE_PATH,
): ApiClient {
  async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${basePath}${path}${toQueryString(options.query)}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    const init: RequestInit = { method, headers, credentials: 'same-origin' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetchFn(url, init);
    } catch (cause) {
      throw new NetworkError(`${method} ${url} failed: no response from the server`, { cause });
    }

    const body = await readBody(response);
    if (!response.ok) {
      throw toApiError(response, body);
    }
    switch (body.kind) {
      case 'json':
        return body.value as T;
      case 'empty':
        if (options.allowEmpty === true) return null as T;
        throw new InvalidResponseError(response.status, `${method} ${url} returned an empty body`);
      case 'invalid':
        throw new InvalidResponseError(response.status, `${method} ${url} returned a body that is not JSON`, {
          cause: body.cause,
        });
    }
  }

  const companyPath = (id: number): string => `/companies/${encodeURIComponent(String(id))}`;
  const adminCompanyPath = (id: number): string => `/admin/companies/${encodeURIComponent(String(id))}`;
  const alertPath = (id: number): string => `/alerts/${encodeURIComponent(String(id))}`;

  return {
    getSummary: (query) => request('GET', '/summary', { query: { ...query } }),
    listCompanies: (query) => request('GET', '/companies', { query: { ...query } }),
    getCompany: (id, query) => request('GET', companyPath(id), { query: { ...query } }),
    listCompanyCandidates: (id, query) => request('GET', `${companyPath(id)}/candidates`, { query: { ...query } }),

    listAdminCompanies: (query) => request('GET', '/admin/companies', { query: { ...query } }),
    createCompany: (body) => request('POST', '/admin/companies', { body }),
    updateCompany: (id, body) => request('PATCH', adminCompanyPath(id), { body }),
    markCompanyReviewed: (id) => request('POST', `${adminCompanyPath(id)}/review`),
    sendCompanyToReview: (id) => request('POST', `${adminCompanyPath(id)}/needs-review`),
    deactivateCompany: (id) => request('POST', `${adminCompanyPath(id)}/deactivate`),
    reprocessCompany: (id) => request('POST', `${adminCompanyPath(id)}/reprocess`),

    enqueueRun: (body) => request('POST', '/runs', { body }),
    listRuns: (query) => request('GET', '/runs', { query: { ...query } }),
    getActiveRun: () => request('GET', '/runs/active', { allowEmpty: true }),
    getRun: (id) => request('GET', `/runs/${encodeURIComponent(String(id))}`),

    getCollectorHealth: () => request('GET', '/collector/health'),

    listAlerts: (query) => request('GET', '/alerts', { query: { ...query } }),
    getAlert: (id) => request('GET', alertPath(id)),
    acknowledgeAlert: (id) => request('POST', `${alertPath(id)}/acknowledge`),
  };
}

/** The client the running app uses: relative `/api` URLs on the page's own origin. */
export const apiClient: ApiClient = createApiClient();

export function toQueryString(query: Readonly<Record<string, QueryValue>> | undefined): string {
  if (query === undefined) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params.append(key, String(value));
  }
  const encoded = params.toString();
  return encoded === '' ? '' : `?${encoded}`;
}

type DecodedBody =
  | { readonly kind: 'json'; readonly value: unknown }
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly text: string; readonly cause: unknown };

async function readBody(response: Response): Promise<DecodedBody> {
  const text = await response.text();
  if (text.trim() === '') return { kind: 'empty' };
  try {
    const value: unknown = JSON.parse(text);
    return { kind: 'json', value };
  } catch (cause) {
    return { kind: 'invalid', text, cause };
  }
}

/** Maps a non-2xx response to the typed error the rest of the app handles. */
function toApiError(response: Response, body: DecodedBody): ApiError {
  const payload = body.kind === 'json' ? body.value : null;
  const message = extractMessage(payload) ?? defaultMessage(response);
  if (response.status === 409 && isRecord(payload) && isRun(payload.activeRun)) {
    return new RunConflictError(message, payload, payload.activeRun);
  }
  return new ApiError(response.status, message, payload);
}

/** NestJS error bodies carry `message` as a string, or a list of validation messages. */
function extractMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const { message } = payload;
  if (typeof message === 'string' && message !== '') return message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === 'string' && part !== '');
    if (parts.length > 0) return parts.join('; ');
  }
  return null;
}

function defaultMessage(response: Response): string {
  return response.statusText === ''
    ? `Request failed with status ${response.status}`
    : `Request failed with status ${response.status} ${response.statusText}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRun(value: unknown): value is Run {
  return isRecord(value) && typeof value.id === 'number' && typeof value.status === 'string' && typeof value.type === 'string';
}
