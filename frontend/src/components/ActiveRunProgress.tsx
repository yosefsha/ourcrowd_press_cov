import { requestErrorMessage } from '../requestErrorMessage.ts';
import { formatDateTime, RUN_STATUS_LABELS, RUN_TRIGGER_LABELS, RUN_TYPE_LABELS } from '../runs.ts';
import type { Run } from '../types.ts';

interface Props {
  run: Run | null | undefined;
  error: Error | null;
}

const statStyle: React.CSSProperties = { display: 'grid', gap: 2, fontSize: 14 };
const statLabelStyle: React.CSSProperties = { color: '#627d98', fontSize: 12 };

/** Live progress of the queued or running Run. */
export function ActiveRunProgress({ run, error }: Props): React.JSX.Element {
  if (error !== null) {
    return (
      <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 14 }}>
        Could not load the active Run: {requestErrorMessage(error)}
      </p>
    );
  }
  if (run === undefined) return <p style={{ margin: 0, fontSize: 14 }}>Loading…</p>;
  if (run === null) return <p style={{ margin: 0, fontSize: 14 }}>No Run is queued or running.</p>;

  const progress = run.progress;
  return (
    <div aria-label="Active Run" role="group" style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 15 }}>
        <strong>
          {RUN_TYPE_LABELS[run.type]} #{run.id}
        </strong>{' '}
        — {RUN_STATUS_LABELS[run.status]} · triggered by {RUN_TRIGGER_LABELS[run.trigger].toLowerCase()} ·{' '}
        {run.startedAt === null ? `queued ${formatDateTime(run.createdAt)}` : `started ${formatDateTime(run.startedAt)}`}
      </div>
      {progress === null ? (
        <p style={{ margin: 0, fontSize: 14 }}>Waiting for the collector to pick up the Run…</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <progress
              aria-label="Companies done"
              value={progress.companiesDone}
              max={Math.max(progress.companiesTotal, 1)}
              style={{ width: 280 }}
            />
            <span style={{ fontSize: 14 }}>
              {progress.companiesDone} / {progress.companiesTotal} companies
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <div style={statStyle}>
              <span style={statLabelStyle}>Candidates classified</span>
              <span>
                {progress.candidatesClassified} / {progress.candidatesFound}
              </span>
            </div>
            <div style={statStyle}>
              <span style={statLabelStyle}>Mentions confirmed</span>
              <span>{progress.mentionsConfirmed}</span>
            </div>
            <div style={statStyle}>
              <span style={statLabelStyle}>Company errors</span>
              <span>{progress.companyErrors}</span>
            </div>
            {progress.currentCompany === null ? null : (
              <div style={statStyle}>
                <span style={statLabelStyle}>Now processing</span>
                <span>{progress.currentCompany}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
