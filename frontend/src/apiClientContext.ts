import { createContext, useContext } from 'react';

import { apiClient, type ApiClient } from './api.ts';

/**
 * The ApiClient the query hooks use. Defaults to the real client; tests supply
 * an in-memory implementation through `ApiClientContext.Provider`.
 */
export const ApiClientContext = createContext<ApiClient>(apiClient);

export function useApiClient(): ApiClient {
  return useContext(ApiClientContext);
}
