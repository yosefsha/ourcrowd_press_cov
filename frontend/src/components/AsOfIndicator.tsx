import { RUN_HISTORY_QUERY } from '../hooks/useRunActivity.ts';
import { ALERTS_POLL_MS, useRunsQuery } from '../queries.ts';
import { formatDateTime, latestCompletedRunAt } from '../runs.ts';
import type { CoverageWindow } from '../types.ts';

interface Props {
  /** Accepted for the shell's slot contract; freshness is a property of Runs, not of the window. */
  coverageWindow: CoverageWindow;
}

/**
 * "As of" slot in the top bar: when the dashboard data was last refreshed,
 * i.e. when the latest completed Run finished. Shares the Run history cache
 * with the Operations page and re-checks it on the alert bell's slow cadence.
 */
export function AsOfIndicator(_props: Props): React.JSX.Element | null {
  const runs = useRunsQuery(RUN_HISTORY_QUERY, { refetchInterval: ALERTS_POLL_MS });

  if (runs.isError) {
    return (
      <span style={{ fontSize: 13, color: '#b42318' }} title="The Run history could not be loaded">
        As of: unavailable
      </span>
    );
  }
  if (runs.data === undefined) return null;

  const asOf = latestCompletedRunAt(runs.data);
  return (
    <span style={{ fontSize: 13, color: '#486581' }}>
      {asOf === null ? 'No completed Run yet' : `As of ${formatDateTime(asOf)}`}
    </span>
  );
}
