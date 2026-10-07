import type { AdminCompany } from '../types.ts';
import { CompanyStatusBadge } from './CompanyStatusBadge.tsx';

interface Props {
  companies: readonly AdminCompany[];
  selectedId: number | null;
  onSelect: (company: AdminCompany) => void;
}

/** Tracked Companies as selectable rows; Needs Review rows are highlighted with their review reason. */
export function AdminCompanyList({ companies, selectedId, onSelect }: Props): React.JSX.Element {
  if (companies.length === 0) {
    return <p style={{ margin: 0, color: '#627d98' }}>No companies match.</p>;
  }
  return (
    <ul aria-label="Tracked companies" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {companies.map((company) => {
        const selected = company.id === selectedId;
        const needsReview = company.status === 'needs_review';
        return (
          <li key={company.id}>
            <button
              type="button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => {
                onSelect(company);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                font: 'inherit',
                cursor: 'pointer',
                borderRadius: 6,
                border: `1px solid ${selected ? '#2f6fde' : needsReview ? '#f0b429' : '#d9e2ec'}`,
                background: needsReview ? '#fffbea' : '#ffffff',
                color: company.status === 'deactivated' ? '#7b8794' : 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{company.displayName}</span>
                <CompanyStatusBadge status={company.status} />
              </span>
              {company.sourceName !== null && company.sourceName !== company.displayName && (
                <span style={{ fontSize: 12, color: '#627d98' }}>Source Name: {company.sourceName}</span>
              )}
              {company.sourceName === null && <span style={{ fontSize: 12, color: '#627d98' }}>Added by hand</span>}
              {needsReview && company.reviewReason !== null && (
                <span style={{ fontSize: 13, color: '#8d2b0b' }}>{company.reviewReason}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
