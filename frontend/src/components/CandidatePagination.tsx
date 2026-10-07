interface Props {
  page: number;
  totalPages: number;
  total: number;
  /** While the requested page loads. */
  disabled: boolean;
  onChange: (page: number) => void;
}

/** Previous / next paging for the detail panel's Mention list. */
export function CandidatePagination({ page, totalPages, total, disabled, onChange }: Props): React.JSX.Element {
  return (
    <nav aria-label="Mentions pages" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => {
          onChange(page - 1);
        }}
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => {
          onChange(page + 1);
        }}
      >
        Next
      </button>
    </nav>
  );
}
