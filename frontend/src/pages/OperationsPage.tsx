import { ActiveRunProgress } from '../components/ActiveRunProgress.tsx';
import { BackfillForm } from '../components/BackfillForm.tsx';
import { CollectorHealthPanel } from '../components/CollectorHealthPanel.tsx';
import { RunHistoryTable } from '../components/RunHistoryTable.tsx';
import { useRunActivity } from '../hooks/useRunActivity.ts';
import { useEnqueueRunMutation } from '../queries.ts';
import { requestErrorMessage } from '../requestErrorMessage.ts';
import type { EnqueueRunRequest } from '../types.ts';

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d9e2ec',
  borderRadius: 8,
  padding: 16,
  display: 'grid',
  gap: 12,
  alignContent: 'start',
};
const cardHeadingStyle: React.CSSProperties = { fontSize: 16, margin: 0 };

/** Start Runs, follow the active one, review Run history and the collector's health. */
export function OperationsPage(): React.JSX.Element {
  const { activeRun, history, health } = useRunActivity();
  const enqueue = useEnqueueRunMutation();

  const current = activeRun.data ?? null;
  // Until the active Run is known the buttons stay disabled; if it cannot be loaded they
  // are enabled, because the API's 409 remains the real guard against a second Run.
  const controlsDisabled = current !== null || activeRun.isPending || enqueue.isPending;

  const start = (request: EnqueueRunRequest): void => {
    enqueue.mutate(request);
  };

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Operations</h1>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section aria-labelledby="ops-backfill" style={cardStyle}>
          <h2 id="ops-backfill" style={cardHeadingStyle}>
            Backfill
          </h2>
          <BackfillForm disabled={controlsDisabled} onStart={start} />
        </section>

        <section aria-labelledby="ops-daily" style={cardStyle}>
          <h2 id="ops-daily" style={cardHeadingStyle}>
            Daily Check
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#486581' }}>
            Collects Candidates published since the previous successful Daily Check and raises an Alert Digest for
            New Mentions.
          </p>
          <div>
            <button
              type="button"
              disabled={controlsDisabled}
              onClick={() => {
                start({ type: 'daily_check' });
              }}
              style={{ padding: '6px 14px', fontSize: 14 }}
            >
              Run Daily Check now
            </button>
          </div>
        </section>

        <section aria-labelledby="ops-health" style={cardStyle}>
          <h2 id="ops-health" style={cardHeadingStyle}>
            Collector health
          </h2>
          <CollectorHealthPanel health={health.data} error={health.error} />
        </section>
      </div>

      {enqueue.isError ? (
        <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 14 }}>
          Could not start the Run. {requestErrorMessage(enqueue.error)}
        </p>
      ) : null}
      {enqueue.isSuccess && current?.id === enqueue.data.id && current.status === 'queued' ? (
        <p role="status" style={{ margin: 0, color: '#1f7a35', fontSize: 14 }}>
          Run #{enqueue.data.id} queued. The collector picks it up within a few seconds.
        </p>
      ) : null}

      <section aria-labelledby="ops-active" style={cardStyle}>
        <h2 id="ops-active" style={cardHeadingStyle}>
          Active Run
        </h2>
        <ActiveRunProgress run={activeRun.data} error={activeRun.error} />
      </section>

      <section aria-labelledby="ops-history" style={cardStyle}>
        <h2 id="ops-history" style={cardHeadingStyle}>
          Run history
        </h2>
        <RunHistoryTable runs={history.data} error={history.error} />
      </section>
    </section>
  );
}
