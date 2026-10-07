import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

import {
  OVERVIEW_PARAMS,
  parseCompanyId,
  parseOverviewFilters,
  writeOverviewFilters,
  type OverviewFilters,
} from '../overviewFilters.ts';

/** The Overview table's filters and sort, read from and written to the URL query. */
export function useOverviewFilters(): readonly [OverviewFilters, (changes: Partial<OverviewFilters>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseOverviewFilters(searchParams);

  const updateFilters = useCallback(
    (changes: Partial<OverviewFilters>): void => {
      setSearchParams((current) => writeOverviewFilters(current, changes));
    },
    [setSearchParams],
  );

  return [filters, updateFilters] as const;
}

/** The Tracked Company whose detail panel is open, kept in the URL; null when none is. */
export function useSelectedCompany(): readonly [number | null, (id: number | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = parseCompanyId(searchParams.get(OVERVIEW_PARAMS.company));

  const select = useCallback(
    (id: number | null): void => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (id === null) next.delete(OVERVIEW_PARAMS.company);
        else next.set(OVERVIEW_PARAMS.company, String(id));
        return next;
      });
    },
    [setSearchParams],
  );

  return [selectedId, select] as const;
}
