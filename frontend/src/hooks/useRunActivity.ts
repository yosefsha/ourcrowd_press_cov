import type { UseQueryResult } from '@tanstack/react-query';

import { ACTIVE_RUN_POLL_MS, useActiveRunQuery, useCollectorHealthQuery, useRunsQuery } from '../queries.ts';
import { RUN_HISTORY_LIMIT, shouldPollRuns } from '../runs.ts';
import type { CollectorHealth, Run, RunsQuery } from '../types.ts';

/** The one history query the Operations page and the "as of" slot share, so they share its cache. */
export const RUN_HISTORY_QUERY: RunsQuery = { limit: RUN_HISTORY_LIMIT };

export interface RunActivity {
  readonly activeRun: UseQueryResult<Run | null>;
  readonly history: UseQueryResult<readonly Run[]>;
  readonly health: UseQueryResult<CollectorHealth>;
  /** True while Run state is changing, i.e. while the live poll is on. */
  readonly isPolling: boolean;
}

/**
 * Active Run, Run history and collector health for the Operations page.
 *
 * The active Run and the history are polled at the live interval only while a
 * Run is queued or running (or the collector reports it is executing one);
 * otherwise they are fetched once and refreshed by mutations. The query hooks
 * take a fixed interval, so the decision is made in two steps: non-polling
 * observers read the cached state, and a second pair of observers on the same
 * keys carries the interval that state implies. Both pairs share one cache
 * entry per key, so this costs no extra requests.
 */
export function useRunActivity(): RunActivity {
  const health = useCollectorHealthQuery();
  const activeProbe = useActiveRunQuery({ refetchInterval: false });
  const historyProbe = useRunsQuery(RUN_HISTORY_QUERY, { refetchInterval: false });

  const isPolling = shouldPollRuns(activeProbe.data, historyProbe.data, health.data);
  const refetchInterval = isPolling ? ACTIVE_RUN_POLL_MS : false;

  const activeRun = useActiveRunQuery({ refetchInterval });
  const history = useRunsQuery(RUN_HISTORY_QUERY, { refetchInterval });

  return { activeRun, history, health, isPolling };
}
