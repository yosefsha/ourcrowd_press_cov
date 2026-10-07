import { Link } from 'react-router';

import type { CompanyProfile } from '../types.ts';

interface Props {
  companyId: number;
  profile: CompanyProfile;
}

/** The Company Profile, read-only; editing happens on the Companies page. */
export function CompanyProfileSummary({ companyId, profile }: Props): React.JSX.Element {
  return (
    <section aria-labelledby="company-profile-heading" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h3 id="company-profile-heading" style={{ margin: 0, fontSize: 15 }}>
          Company Profile
        </h3>
        <Link to={{ pathname: '/companies', search: `?company=${companyId}` }} style={{ fontSize: 13 }}>
          Edit on Companies page
        </Link>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 12px', margin: 0, fontSize: 14 }}>
        <dt style={termStyle}>Aliases</dt>
        <dd style={definitionStyle}>{joinOrNone(profile.aliases)}</dd>
        <dt style={termStyle}>Description</dt>
        <dd style={definitionStyle}>{profile.description ?? 'None'}</dd>
        <dt style={termStyle}>Search terms</dt>
        <dd style={definitionStyle}>{joinOrNone(profile.searchTerms)}</dd>
      </dl>
    </section>
  );
}

function joinOrNone(values: readonly string[]): string {
  return values.length === 0 ? 'None' : values.join(', ');
}

const termStyle: React.CSSProperties = { color: '#627d98' };
const definitionStyle: React.CSSProperties = { margin: 0, overflowWrap: 'anywhere' };
