import { describe, expect, it, vi } from 'vitest';

import { createApiClient, toQueryString, type ApiClient, type FetchFn } from './api.ts';
import { ApiError, InvalidResponseError, NetworkError, RunConflictError } from './apiErrors.ts';
import { buildRun } from './test/fixtures.ts';

interface RecordedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

function jsonResponse(status: number, body: unknown, statusText = ''): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A client whose transport answers every request with `respond()` and records what was sent. */
function clientAnswering(respond: () => Response | Promise<Response>): {
  client: ApiClient;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetchFn: FetchFn = (url, init) => {
    requests.push({ url, init });
    return Promise.resolve(respond());
  };
  return { client: createApiClient(fetchFn), requests };
}

describe('toQueryString', () => {
  it('omits undefined and empty values and encodes the rest', () => {
    expect(toQueryString({ window: '2026-Q3', q: 'a&b', status: undefined, hasNegatives: false, sort: '' })).toBe(
      '?window=2026-Q3&q=a%26b&hasNegatives=false',
    );
  });

  it('is empty when nothing is set', () => {
    expect(toQueryString(undefined)).toBe('');
    expect(toQueryString({ q: undefined })).toBe('');
  });
});

describe('request building', () => {
  it('sends GETs to relative /api URLs with the query string', async () => {
    const { client, requests } = clientAnswering(() => jsonResponse(200, []));
    await client.listCompanies({ window: 'rolling90', hasNegatives: true, sort: 'recency' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('/api/companies?window=rolling90&hasNegatives=true&sort=recency');
    expect(requests[0]?.init.method).toBe('GET');
    expect(requests[0]?.init.body).toBeUndefined();
    expect(requests[0]?.init.credentials).toBe('same-origin');
  });

  it('sends JSON bodies for POST and PATCH', async () => {
    const { client, requests } = clientAnswering(() => jsonResponse(200, {}));
    await client.updateCompany(42, { displayName: 'New name', aliases: ['Old name'] });
    expect(requests[0]?.url).toBe('/api/admin/companies/42');
    expect(requests[0]?.init.method).toBe('PATCH');
    expect(requests[0]?.init.body).toBe(JSON.stringify({ displayName: 'New name', aliases: ['Old name'] }));
    expect(requests[0]?.init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it.each<[string, (client: ApiClient) => Promise<unknown>, string, string]>([
    ['getSummary', (c) => c.getSummary({ window: '2026-Q3' }), 'GET', '/api/summary?window=2026-Q3'],
    ['getCompany', (c) => c.getCompany(5, { window: 'rolling90' }), 'GET', '/api/companies/5?window=rolling90'],
    [
      'listCompanyCandidates',
      (c) => c.listCompanyCandidates(5, { window: 'rolling90', include: 'rejected', page: 2, pageSize: 50 }),
      'GET',
      '/api/companies/5/candidates?window=rolling90&include=rejected&page=2&pageSize=50',
    ],
    [
      'listAdminCompanies',
      (c) => c.listAdminCompanies({ status: 'needs_review' }),
      'GET',
      '/api/admin/companies?status=needs_review',
    ],
    ['createCompany', (c) => c.createCompany({ displayName: 'X' }), 'POST', '/api/admin/companies'],
    ['markCompanyReviewed', (c) => c.markCompanyReviewed(5), 'POST', '/api/admin/companies/5/review'],
    ['sendCompanyToReview', (c) => c.sendCompanyToReview(5), 'POST', '/api/admin/companies/5/needs-review'],
    ['deactivateCompany', (c) => c.deactivateCompany(5), 'POST', '/api/admin/companies/5/deactivate'],
    ['reprocessCompany', (c) => c.reprocessCompany(5), 'POST', '/api/admin/companies/5/reprocess'],
    ['enqueueRun', (c) => c.enqueueRun({ type: 'backfill', until: '2026-09-30' }), 'POST', '/api/runs'],
    ['listRuns', (c) => c.listRuns({ limit: 20 }), 'GET', '/api/runs?limit=20'],
    ['getActiveRun', (c) => c.getActiveRun(), 'GET', '/api/runs/active'],
    ['getRun', (c) => c.getRun(5), 'GET', '/api/runs/5'],
    ['getCollectorHealth', (c) => c.getCollectorHealth(), 'GET', '/api/collector/health'],
    ['listAlerts', (c) => c.listAlerts({ acknowledged: false }), 'GET', '/api/alerts?acknowledged=false'],
    ['getAlert', (c) => c.getAlert(3), 'GET', '/api/alerts/3'],
    ['acknowledgeAlert', (c) => c.acknowledgeAlert(3), 'POST', '/api/alerts/3/acknowledge'],
  ])('%s calls %s %s', async (_name, call, method, url) => {
    const { client, requests } = clientAnswering(() => jsonResponse(200, {}));
    await call(client);
    expect(requests[0]?.init.method).toBe(method);
    expect(requests[0]?.url).toBe(url);
  });
});

describe('successful responses', () => {
  it('returns the decoded JSON body', async () => {
    const run = buildRun({ status: 'queued' });
    const { client } = clientAnswering(() => jsonResponse(202, run));
    await expect(client.enqueueRun({ type: 'daily_check' })).resolves.toEqual(run);
  });

  it('reads an idle queue as null from a 204 or a JSON null', async () => {
    await expect(clientAnswering(() => new Response(null, { status: 204 })).client.getActiveRun()).resolves.toBeNull();
    await expect(clientAnswering(() => jsonResponse(200, null)).client.getActiveRun()).resolves.toBeNull();
  });

  it('rejects an empty body where the contract promises JSON', async () => {
    const { client } = clientAnswering(() => new Response(null, { status: 204 }));
    await expect(client.getCollectorHealth()).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('rejects a 2xx body that is not JSON', async () => {
    const { client } = clientAnswering(() => new Response('<html>proxy page</html>', { status: 200 }));
    const error = await client.getSummary({ window: 'rolling90' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidResponseError);
    expect((error as InvalidResponseError).status).toBe(200);
  });
});

describe('error mapping', () => {
  it('maps a NestJS error body to ApiError with its status and message', async () => {
    const { client } = clientAnswering(() =>
      jsonResponse(404, { statusCode: 404, message: 'Tracked Company 9 not found', error: 'Not Found' }),
    );
    const error = await client.getCompany(9, { window: 'rolling90' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(RunConflictError);
    expect(error).toMatchObject({ status: 404, message: 'Tracked Company 9 not found', isClientError: true });
  });

  it('joins validation messages from a 400', async () => {
    const { client } = clientAnswering(() =>
      jsonResponse(400, {
        statusCode: 400,
        message: ['property sourceName should not exist', 'displayName must be a string'],
        error: 'Bad Request',
      }),
    );
    await expect(client.createCompany({ displayName: '' })).rejects.toMatchObject({
      status: 400,
      message: 'property sourceName should not exist; displayName must be a string',
    });
  });

  it('falls back to the status line when the body has no message', async () => {
    const { client } = clientAnswering(() => new Response('upstream down', { status: 502, statusText: 'Bad Gateway' }));
    const error = await client.getSummary({ window: 'rolling90' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 502,
      message: 'Request failed with status 502 Bad Gateway',
      body: null,
      isClientError: false,
    });
  });

  it('falls back to the status code alone when there is no status text', async () => {
    const { client } = clientAnswering(() => new Response(null, { status: 500 }));
    await expect(client.listRuns({})).rejects.toMatchObject({
      status: 500,
      message: 'Request failed with status 500',
    });
  });

  it('maps a 409 carrying the active Run to RunConflictError', async () => {
    const activeRun = buildRun({ id: 11, type: 'backfill' });
    const { client } = clientAnswering(() =>
      jsonResponse(409, { statusCode: 409, message: 'A Run is already queued or running', activeRun }),
    );
    const error = await client.enqueueRun({ type: 'daily_check' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RunConflictError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'A Run is already queued or running', activeRun });
  });

  it('keeps a 409 without an active Run as a plain ApiError', async () => {
    const { client } = clientAnswering(() =>
      jsonResponse(409, { statusCode: 409, message: 'A company named Example Co already exists' }),
    );
    const error = await client.createCompany({ displayName: 'Example Co' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(RunConflictError);
    expect(error).toMatchObject({ status: 409 });
  });

  it('wraps a transport failure in NetworkError with the cause attached', async () => {
    const cause = new TypeError('Failed to fetch');
    const fetchFn = vi.fn<FetchFn>().mockRejectedValue(cause);
    const error = await createApiClient(fetchFn)
      .getCollectorHealth()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).cause).toBe(cause);
    expect((error as NetworkError).message).toContain('GET /api/collector/health');
  });
});
