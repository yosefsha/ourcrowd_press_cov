import { MENTION_STATUS_LABELS } from '../coverageFormat.ts';
import type { MentionStatus } from '../types.ts';

interface Props {
  status: MentionStatus;
}

const BADGE_COLORS: Readonly<Record<MentionStatus, { readonly background: string; readonly color: string }>> = {
  active: { background: '#e3f9e5', color: '#0e5814' },
  recent: { background: '#e6f6ff', color: '#035388' },
  quiet: { background: '#fffbea', color: '#8d2b0b' },
  no_coverage: { background: '#e4e7eb', color: '#323f4b' },
};

/** A Tracked Company's Mention Status as a coloured pill. */
export function StatusBadge({ status }: Props): React.JSX.Element {
  const colors = BADGE_COLORS[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...colors,
      }}
    >
      {MENTION_STATUS_LABELS[status]}
    </span>
  );
}
