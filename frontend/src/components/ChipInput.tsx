import { useId, useState } from 'react';

import { addChip, removeChip } from '../companyProfileForm.ts';
import { ProfileFieldErrors } from './ProfileFieldErrors.tsx';

interface Props {
  label: string;
  /** Singular noun for the remove buttons' accessible names, e.g. "alias". */
  itemNoun: string;
  values: readonly string[];
  onChange: (values: readonly string[]) => void;
  errors?: readonly string[] | undefined;
  hint?: string;
}

/** A list of short strings edited as removable chips; Enter, comma or leaving the field adds the typed one. */
export function ChipInput({ label, itemNoun, values, onChange, errors, hint }: Props): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const hasErrors = errors !== undefined && errors.length > 0;
  const describedBy = [hint === undefined ? null : hintId, hasErrors ? errorId : null].filter((id) => id !== null);

  function commitDraft(): void {
    const next = addChip(values, draft);
    if (next !== values) onChange(next);
    setDraft('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={inputId} style={{ fontWeight: 600, fontSize: 14 }}>
        {label}
      </label>
      {values.length > 0 && (
        <ul aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
          {values.map((value) => (
            <li
              key={value}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 4px 2px 10px',
                borderRadius: 12,
                background: '#e0e8f9',
                fontSize: 13,
              }}
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${itemNoun} ${value}`}
                onClick={() => {
                  onChange(removeChip(values, value));
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 4px', fontSize: 14 }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        value={draft}
        aria-invalid={hasErrors}
        aria-describedby={describedBy.length > 0 ? describedBy.join(' ') : undefined}
        placeholder={`Add ${itemNoun} and press Enter`}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
        style={{ padding: '6px 8px', border: '1px solid #bcccdc', borderRadius: 4 }}
      />
      {hint !== undefined && (
        <span id={hintId} style={{ fontSize: 12, color: '#627d98' }}>
          {hint}
        </span>
      )}
      <ProfileFieldErrors id={errorId} errors={errors} />
    </div>
  );
}
