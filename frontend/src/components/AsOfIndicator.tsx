import type { CoverageWindow } from '../types.ts';

interface Props {
  coverageWindow: CoverageWindow;
}

/**
 * "As of" slot in the top bar: when the dashboard data was last refreshed.
 * Placeholder until the Overview issue (#13) fills it from `useSummaryQuery`.
 */
export function AsOfIndicator(_props: Props): React.JSX.Element | null {
  return null;
}
