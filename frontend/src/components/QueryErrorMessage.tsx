interface Props {
  /** What failed to load, e.g. "the summary". */
  subject: string;
  error: Error;
  onRetry: () => void;
}

/** A failed query, with the server's message and a way to try again. */
export function QueryErrorMessage({ subject, error, onRetry }: Props): React.JSX.Element {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: '#ffeeee',
        border: '1px solid #f29b9b',
        borderRadius: 8,
        color: '#610316',
      }}
    >
      <span>
        Could not load {subject}: {error.message}
      </span>
      <button type="button" onClick={onRetry} style={{ marginLeft: 'auto' }}>
        Retry
      </button>
    </div>
  );
}
