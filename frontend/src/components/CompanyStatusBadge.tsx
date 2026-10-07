import type { TrackedCompanyStatus } from '../types.ts';

interface Props {
  status: TrackedCompanyStatus;
}

const BADGES: Readonly<Record<TrackedCompanyStatus, { label: string; color: string; background: string }>> = {
  active: { label: 'Active', color: '#0e5a2c', background: '#e3f9e5' },
  needs_review: { label: 'Needs Review', color: '#8d2b0b', background: '#ffe8b3' },
  deactivated: { label: 'Deactivated', color: '#52606d', background: '#e4e7eb' },
};

/** The lifecycle status of a Tracked Company as a coloured label. */
export function CompanyStatusBadge({ status }: Props): React.JSX.Element {
  const badge = BADGES[status];
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        color: badge.color,
        background: badge.background,
        whiteSpace: 'nowrap',
      }}
    >
      {badge.label}
    </span>
  );
}
