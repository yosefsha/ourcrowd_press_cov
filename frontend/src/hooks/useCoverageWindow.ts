import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

import { DEFAULT_COVERAGE_WINDOW, parseCoverageWindow } from '../coverageWindow.ts';
import type { CoverageWindow } from '../types.ts';

/** The URL search parameter that holds the Coverage Window. */
export const COVERAGE_WINDOW_PARAM = 'window';

/**
 * The selected Coverage Window, kept in the URL so it survives reloads and
 * shared links. A missing or malformed value reads as the default window.
 */
export function useCoverageWindow(): readonly [CoverageWindow, (window: CoverageWindow) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const coverageWindow = parseCoverageWindow(searchParams.get(COVERAGE_WINDOW_PARAM)) ?? DEFAULT_COVERAGE_WINDOW;

  const setCoverageWindow = useCallback(
    (window: CoverageWindow): void => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (window === DEFAULT_COVERAGE_WINDOW) next.delete(COVERAGE_WINDOW_PARAM);
        else next.set(COVERAGE_WINDOW_PARAM, window);
        return next;
      });
    },
    [setSearchParams],
  );

  return [coverageWindow, setCoverageWindow] as const;
}
