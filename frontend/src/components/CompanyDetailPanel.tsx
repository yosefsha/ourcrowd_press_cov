import { useCompanyQuery } from '../queries.ts';
import type { CoverageWindow } from '../types.ts';
import { CandidateList } from './CandidateList.tsx';
import { CompanyDetailHeader } from './CompanyDetailHeader.tsx';
import { CompanyProfileSummary } from './CompanyProfileSummary.tsx';
import { WeeklyMentionsChart } from './WeeklyMentionsChart.tsx';

interface Props {
  companyId: number;
  coverageWindow: CoverageWindow;
  onClose: () => void;
}

/**
 * Everything about one Tracked Company in the selected Coverage Window: header,
 * Weekly Mentions chart, Mention list and the read-only Company Profile.
 * The props are the contract the Overview page (#13) renders it with.
 */
export function CompanyDetailPanel({ companyId, coverageWindow, onClose }: Props): React.JSX.Element {
  const detail = useCompanyQuery(companyId, coverageWindow);

  return (
    <aside
      aria-label="Company detail"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: 20,
        background: '#ffffff',
        border: '1px solid #d9e2ec',
        borderRadius: 8,
        minWidth: 0,
      }}
    >
      {detail.status === 'pending' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ margin: 0, color: '#627d98' }}>Loading company…</p>
          <button type="button" onClick={onClose} aria-label="Close company detail">
            Close
          </button>
        </div>
      ) : detail.status === 'error' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <p role="alert" style={{ margin: 0, color: '#ab091e' }}>
            Could not load this company: {detail.error.message}
          </p>
          <button type="button" onClick={onClose} aria-label="Close company detail">
            Close
          </button>
        </div>
      ) : (
        <>
          <CompanyDetailHeader detail={detail.data} onClose={onClose} />
          <WeeklyMentionsChart series={detail.data.weeklySeries} />
          <CandidateList key={`${companyId}:${coverageWindow}`} companyId={companyId} coverageWindow={coverageWindow} />
          <CompanyProfileSummary companyId={companyId} profile={detail.data.profile} />
        </>
      )}
    </aside>
  );
}
