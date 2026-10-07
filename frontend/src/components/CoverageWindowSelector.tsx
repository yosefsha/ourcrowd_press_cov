import { useId, useState, type ChangeEvent } from 'react';

import { listCoverageWindows, parseCoverageWindow } from '../coverageWindow.ts';
import type { CoverageWindow } from '../types.ts';

interface Props {
  value: CoverageWindow;
  onChange: (window: CoverageWindow) => void;
}

export function CoverageWindowSelector({ value, onChange }: Props): React.JSX.Element {
  const id = useId();
  // The list of quarters is fixed for the lifetime of the page.
  const [options] = useState(() => listCoverageWindows(new Date()));

  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const selected = parseCoverageWindow(event.target.value);
    if (selected !== null) onChange(selected);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor={id} style={{ fontSize: 14 }}>
        Coverage window
      </label>
      <select id={id} value={value} onChange={handleChange} style={{ padding: '4px 8px', fontSize: 14 }}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {options.some((option) => option.value === value) ? null : <option value={value}>{value}</option>}
      </select>
    </div>
  );
}
