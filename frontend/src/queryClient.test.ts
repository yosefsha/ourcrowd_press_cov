import { describe, expect, it } from 'vitest';

import { ApiError, NetworkError } from './apiErrors.ts';
import { createQueryClient, DEFAULT_STALE_TIME_MS, MAX_QUERY_RETRIES, shouldRetryQuery } from './queryClient.ts';

describe('shouldRetryQuery', () => {
  it.each([400, 404, 409, 422])('never retries a %i', (status) => {
    expect(shouldRetryQuery(0, new ApiError(status, 'nope', null))).toBe(false);
  });

  it.each([
    ['a 5xx', new ApiError(503, 'unavailable', null)],
    ['a network failure', new NetworkError('offline')],
  ])('retries %s up to the limit', (_label, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, error)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, error)).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('applies the stale time to queries and disables mutation retries', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(DEFAULT_STALE_TIME_MS);
    expect(defaults.queries?.retry).toBe(shouldRetryQuery);
    expect(defaults.mutations?.retry).toBe(false);
  });
});
