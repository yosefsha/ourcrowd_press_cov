import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './apiErrors.ts';

/** Server data younger than this is served from cache without a refetch. */
export const DEFAULT_STALE_TIME_MS = 30_000;

/** Transient failures (network, 5xx) are retried this many times before surfacing. */
export const MAX_QUERY_RETRIES = 2;

/**
 * Retry policy for queries: a 4xx means the request itself is wrong, so
 * repeating it cannot succeed and only delays the error the user needs to see.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.isClientError) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: shouldRetryQuery,
      },
      mutations: {
        // State-changing requests are never repeated behind the user's back.
        retry: false,
      },
    },
  });
}
