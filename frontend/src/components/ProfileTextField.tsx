import { useId } from 'react';

import { ProfileFieldErrors } from './ProfileFieldErrors.tsx';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors?: readonly string[] | undefined;
  hint?: string;
  multiline?: boolean;
}

/** A labelled text input or textarea with its hint and server validation messages. */
export function ProfileTextField({ label, value, onChange, errors, hint, multiline = false }: Props): React.JSX.Element {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const hasErrors = errors !== undefined && errors.length > 0;
  const describedBy = [hint === undefined ? null : hintId, hasErrors ? errorId : null].filter((id) => id !== null);
  const common = {
    id: inputId,
    value,
    'aria-invalid': hasErrors,
    'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
    style: { padding: '6px 8px', border: `1px solid ${hasErrors ? '#ab091e' : '#bcccdc'}`, borderRadius: 4, font: 'inherit' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={inputId} style={{ fontWeight: 600, fontSize: 14 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          {...common}
          rows={2}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : (
        <input
          {...common}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
      {hint !== undefined && (
        <span id={hintId} style={{ fontSize: 12, color: '#627d98' }}>
          {hint}
        </span>
      )}
      <ProfileFieldErrors id={errorId} errors={errors} />
    </div>
  );
}
