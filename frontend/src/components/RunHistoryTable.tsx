import { useState } from 'react';

import { requestErrorMessage } from '../requestErrorMessage.ts';
import { formatDateTime, formatDuration, RUN_STATUS_LABELS, RUN_TRIGGER_LABELS, RUN_TYPE_LABELS } from '../runs.ts';
import type { Run, RunStatus } from '../types.ts';
import { RunCompanyErrorList } from './RunCompanyErrorList.tsx';

interface Props {
  runs: readonly Run[] | undefined;
  error: Error | null;
}

const STATUS_COLORS: Readonly<Record<RunStatus, string>> = {
  queued: '#486581',
  running: '#2563eb',
  completed: '#1f7a35',
  completed_with_errors: '#b54708',
  failed: '#b42318',
  interrupted: '#b42318',
};

const cellStyle: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #e4e7eb', verticalAlign: 'top' };
const headStyle: React.CSSProperties = { ...cellStyle, textAlign: 'left', fontWeight: 600, color: '#486581' };

function scopeOf(run: Run): string {
  const parts: string[] = [];
  if (run.params.until !== null) parts.push(`until ${run.params.until}`);
  if (run.params.companyIds !== null) parts.push(`${run.params.companyIds.length} companies`);
  if (run.params.reprocess) parts.push('re-process');
  return parts.length === 0 ? '—' : parts.join(', ');
}

/** Recent Runs, newest first as the API returns them. */
export function RunHistoryTable({ runs, error }: Props): React.JSX.Element {
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);

  if (error !== null) {
    return (
      <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 14 }}>
        Could not load the Run history: {requestErrorMessage(error)}
      </p>
    );
  }
  if (runs === undefined) return <p style={{ margin: 0, fontSize: 14 }}>Loading…</p>;
  if (runs.length === 0) return <p style={{ margin: 0, fontSize: 14 }}>No Runs yet.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table aria-label="Run history" style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
        <thead>
          <tr>
            <th style={headStyle}>Run</th>
            <th style={headStyle}>Type</th>
            <th style={headStyle}>Trigger</th>
            <th style={headStyle}>Status</th>
            <th style={headStyle}>Scope</th>
            <th style={headStyle}>Started</th>
            <th style={headStyle}>Finished</th>
            <th style={headStyle}>Duration</th>
            <th style={headStyle}>Companies</th>
            <th style={headStyle}>Candidates</th>
            <th style={headStyle}>Mentions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const progress = run.progress;
            const companyErrors = progress?.companyErrors ?? 0;
            return (
              <tr key={run.id}>
                <td style={cellStyle}>#{run.id}</td>
                <td style={cellStyle}>{RUN_TYPE_LABELS[run.type]}</td>
                <td style={cellStyle}>{RUN_TRIGGER_LABELS[run.trigger]}</td>
                <td style={cellStyle}>
                  <span style={{ color: STATUS_COLORS[run.status], fontWeight: 600 }}>{RUN_STATUS_LABELS[run.status]}</span>
                  {companyErrors > 0 ? (
                    <div style={{ color: '#b54708' }}>
                      <button
                        type="button"
                        aria-expanded={expandedRunId === run.id}
                        onClick={() => {
                          setExpandedRunId(expandedRunId === run.id ? null : run.id);
                        }}
                        style={{ padding: 0, border: 'none', background: 'none', color: 'inherit', font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {companyErrors} company {companyErrors === 1 ? 'error' : 'errors'}
                      </button>
                      {expandedRunId === run.id ? <RunCompanyErrorList runId={run.id} /> : null}
                    </div>
                  ) : null}
                  {run.error === null ? null : <div style={{ color: '#b42318', whiteSpace: 'pre-wrap' }}>{run.error}</div>}
                </td>
                <td style={cellStyle}>{scopeOf(run)}</td>
                <td style={cellStyle}>{run.startedAt === null ? '—' : formatDateTime(run.startedAt)}</td>
                <td style={cellStyle}>{run.finishedAt === null ? '—' : formatDateTime(run.finishedAt)}</td>
                <td style={cellStyle}>{formatDuration(run.startedAt, run.finishedAt) ?? '—'}</td>
                <td style={cellStyle}>{progress === null ? '—' : `${progress.companiesDone} / ${progress.companiesTotal}`}</td>
                <td style={cellStyle}>
                  {progress === null ? '—' : `${progress.candidatesClassified} / ${progress.candidatesFound} classified`}
                </td>
                <td style={cellStyle}>{progress === null ? '—' : progress.mentionsConfirmed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
