import { useState } from 'react';

import { RunConflictError } from '../apiErrors.ts';
import { useReprocessCompanyMutation } from '../queries.ts';
import type { Run, RunType } from '../types.ts';
import { dangerButtonStyle, secondaryButtonStyle } from './companiesPageStyles.ts';

interface Props {
  companyId: number;
  displayName: string;
  /** Only an active company can be collected for; Needs Review and deactivated ones are excluded from Runs. */
  enabled: boolean;
  /** Draws attention to the control, e.g. right after the profile was saved or reviewed. */
  highlighted: boolean;
}

const RUN_TYPE_LABELS: Readonly<Record<RunType, string>> = {
  backfill: 'Backfill',
  daily_check: 'Daily Check',
};

function describeActiveRun(run: Run): string {
  const state = run.status === 'queued' ? 'queued' : 'running';
  return `${RUN_TYPE_LABELS[run.type]} #${run.id} is ${state}`;
}

/** Re-process one Tracked Company, after an in-page confirmation that its history will be replaced. */
export function ReprocessControl({ companyId, displayName, enabled, highlighted }: Props): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const reprocess = useReprocessCompanyMutation();
  const { error, data: queuedRun } = reprocess;

  return (
    <section
      aria-label="Re-process"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        borderRadius: 6,
        border: `1px solid ${highlighted ? '#2f6fde' : '#d9e2ec'}`,
        background: highlighted ? '#eef4fd' : '#ffffff',
      }}
    >
      <h3 style={{ margin: 0, fontSize: 15 }}>Re-process</h3>
      <p style={{ margin: 0, fontSize: 14 }}>
        Re-processing deletes this company&apos;s Candidates, Relevance Verdicts and Mentions, then queues a Backfill
        limited to it that searches and classifies afresh with the current profile. Its history is replaced, not kept,
        and a Backfill never sends alerts.
      </p>
      {!enabled && (
        <p style={{ margin: 0, fontSize: 14, color: '#627d98' }}>Only an active company can be re-processed.</p>
      )}
      {queuedRun !== undefined && (
        <p role="status" style={{ margin: 0, fontSize: 14, color: '#0e7c3a' }}>
          Backfill #{queuedRun.id} queued for {displayName}. Follow its progress on the Operations page.
        </p>
      )}
      {error !== null && (
        <p role="alert" style={{ margin: 0, fontSize: 14, color: '#ab091e' }}>
          {error instanceof RunConflictError
            ? `Another Run is active (${describeActiveRun(error.activeRun)}). Re-process once it has finished.`
            : `Could not re-process: ${error.message}`}
        </p>
      )}
      {confirming && enabled ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>Replace all collected history for {displayName}?</span>
          <button
            type="button"
            disabled={reprocess.isPending || !enabled}
            onClick={() => {
              reprocess.mutate(companyId, {
                onSettled: () => {
                  setConfirming(false);
                },
              });
            }}
            style={dangerButtonStyle}
          >
            {reprocess.isPending ? 'Queuing…' : 'Replace history and re-process'}
          </button>
          <button
            type="button"
            disabled={reprocess.isPending}
            onClick={() => {
              setConfirming(false);
            }}
            style={secondaryButtonStyle}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            disabled={!enabled}
            onClick={() => {
              reprocess.reset();
              setConfirming(true);
            }}
            style={secondaryButtonStyle}
          >
            Re-process…
          </button>
        </div>
      )}
    </section>
  );
}
