import { useId, useState, type ChangeEvent, type SubmitEvent } from 'react';

import { useAdminCompaniesQuery } from '../queries.ts';
import { requestErrorMessage } from '../requestErrorMessage.ts';
import { resolveBackfillCutoff, toIsoDate, type BackfillCutoff } from '../runs.ts';
import type { EnqueueRunRequest } from '../types.ts';

interface Props {
  /** A Run is queued or running, or an enqueue is in flight. */
  disabled: boolean;
  onStart: (request: EnqueueRunRequest) => void;
}

type CutoffKind = BackfillCutoff['kind'];

function buildCutoff(kind: CutoffKind, date: string, days: string): BackfillCutoff {
  switch (kind) {
    case 'today':
      return { kind };
    case 'date':
      return { kind, date };
    case 'daysAgo':
      return { kind, days };
  }
}

const fieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 };

/** Start a Backfill with an optional cutoff (`until`) and an optional subset of Tracked Companies. */
export function BackfillForm({ disabled, onStart }: Props): React.JSX.Element {
  const idPrefix = useId();
  const [cutoffKind, setCutoffKind] = useState<CutoffKind>('today');
  const [date, setDate] = useState('');
  const [days, setDays] = useState('7');
  const [companyIds, setCompanyIds] = useState<readonly number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const companies = useAdminCompaniesQuery({ status: 'active' });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const resolved = resolveBackfillCutoff(buildCutoff(cutoffKind, date, days), new Date());
    if (!resolved.ok) {
      setValidationError(resolved.error);
      return;
    }
    setValidationError(null);
    onStart({
      type: 'backfill',
      ...(resolved.until === undefined ? {} : { until: resolved.until }),
      ...(companyIds.length === 0 ? {} : { companyIds }),
    });
  };

  const handleCompaniesChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setCompanyIds(Array.from(event.target.selectedOptions, (option) => Number(option.value)));
  };

  const radio = (kind: CutoffKind, label: string): React.JSX.Element => (
    <label style={fieldStyle}>
      <input
        type="radio"
        name={`${idPrefix}-cutoff`}
        value={kind}
        checked={cutoffKind === kind}
        onChange={() => {
          setCutoffKind(kind);
        }}
      />
      {label}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Start Backfill" style={{ display: 'grid', gap: 12 }}>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Cutoff</legend>
        {radio('today', 'Up to today')}
        <div style={fieldStyle}>
          {radio('date', 'Up to a date')}
          <input
            type="date"
            aria-label="Cutoff date"
            value={date}
            max={toIsoDate(new Date())}
            disabled={cutoffKind !== 'date'}
            onChange={(event) => {
              setDate(event.target.value);
            }}
          />
        </div>
        <div style={fieldStyle}>
          {radio('daysAgo', 'Up to')}
          <input
            type="number"
            aria-label="Days ago"
            min={1}
            step={1}
            value={days}
            disabled={cutoffKind !== 'daysAgo'}
            onChange={(event) => {
              setDays(event.target.value);
            }}
            style={{ width: 72 }}
          />
          <span>days ago</span>
        </div>
      </fieldset>

      <div style={{ display: 'grid', gap: 4 }}>
        <label htmlFor={`${idPrefix}-companies`} style={{ fontSize: 14, fontWeight: 600 }}>
          Companies <span style={{ fontWeight: 400, color: '#627d98' }}>(optional — none selected means all active)</span>
        </label>
        {companies.isError ? (
          <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 14 }}>
            Could not load the company list: {requestErrorMessage(companies.error)}
          </p>
        ) : (
          <select
            id={`${idPrefix}-companies`}
            multiple
            size={6}
            value={companyIds.map(String)}
            onChange={handleCompaniesChange}
            disabled={companies.isPending}
            style={{ maxWidth: 360, fontSize: 14 }}
          >
            {(companies.data ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      {validationError === null ? null : (
        <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 14 }}>
          {validationError}
        </p>
      )}

      <div>
        <button type="submit" disabled={disabled} style={{ padding: '6px 14px', fontSize: 14 }}>
          Start Backfill
        </button>
      </div>
    </form>
  );
}
