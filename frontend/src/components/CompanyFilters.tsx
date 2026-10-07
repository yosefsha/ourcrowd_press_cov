import { useCallback, useId, type ChangeEvent } from 'react';

import { MENTION_STATUS_LABELS } from '../coverageFormat.ts';
import { parseMentionStatus, type OverviewFilters } from '../overviewFilters.ts';
import { MENTION_STATUSES } from '../types.ts';
import { CompanySearchBox } from './CompanySearchBox.tsx';

interface Props {
  filters: OverviewFilters;
  onChange: (changes: Partial<OverviewFilters>) => void;
}

const ALL_STATUSES = '';

/** Filter controls above the company table: Mention Status, has negatives, name search. */
export function CompanyFilters({ filters, onChange }: Props): React.JSX.Element {
  const statusId = useId();
  const negativesId = useId();
  // Stable, so a re-render while the user types does not restart the search debounce.
  const handleSearch = useCallback(
    (q: string): void => {
      onChange({ q });
    },
    [onChange],
  );

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onChange({ status: parseMentionStatus(event.target.value) });
  };

  return (
    <div role="search" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor={statusId} style={{ fontSize: 14 }}>
          Mention status
        </label>
        <select
          id={statusId}
          value={filters.status ?? ALL_STATUSES}
          onChange={handleStatusChange}
          style={{ padding: '4px 8px', fontSize: 14 }}
        >
          <option value={ALL_STATUSES}>All</option>
          {MENTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {MENTION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          id={negativesId}
          type="checkbox"
          checked={filters.hasNegatives}
          onChange={(event) => {
            onChange({ hasNegatives: event.target.checked });
          }}
        />
        <label htmlFor={negativesId} style={{ fontSize: 14 }}>
          Has negative Mentions
        </label>
      </div>
      <CompanySearchBox value={filters.q} onSearch={handleSearch} />
    </div>
  );
}
