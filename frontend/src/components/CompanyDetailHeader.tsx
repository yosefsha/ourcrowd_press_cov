import type { CompanyDetail } from '../types.ts';
import { formatDate, formatMentionCount, formatPercent, isHighRejectionRate, MENTION_STATUS_LABELS } from './companyDetailData.ts';

interface Props {
  detail: CompanyDetail;
  onClose: () => void;
}

/** Name, Mention Status, Mentions in the window and rejection rate, with a hint when the rate is high. */
export function CompanyDetailHeader({ detail, onClose }: Props): React.JSX.Element {
  const { rejectionRate } = detail;
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{detail.profile.displayName}</h2>
        <button type="button" onClick={onClose} aria-label="Close company detail">
          Close
        </button>
      </div>
      <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', margin: 0, fontSize: 14 }}>
        {renderStat('Mention Status', MENTION_STATUS_LABELS[detail.mentionStatus])}
        {renderStat('Last Mention', detail.lastMentionAt === null ? 'None found' : formatDate(detail.lastMentionAt))}
        {renderStat('Mentions in window', formatMentionCount(detail.mentionCount, detail.capped))}
        {renderStat('Rejection rate', rejectionRate === null ? 'No Candidates' : formatPercent(rejectionRate))}
      </dl>
      {rejectionRate !== null && isHighRejectionRate(rejectionRate) ? (
        <p role="note" style={{ margin: 0, padding: '6px 10px', fontSize: 13, background: '#fff8e1', borderRadius: 4 }}>
          {formatPercent(rejectionRate)} of Candidates were rejected as not about this company — consider reviewing
          this company&apos;s profile.
        </p>
      ) : null}
    </header>
  );
}

function renderStat(term: string, value: string): React.JSX.Element {
  return (
    <div key={term} style={{ display: 'flex', flexDirection: 'column' }}>
      <dt style={{ fontSize: 12, color: '#627d98' }}>{term}</dt>
      <dd style={{ margin: 0, fontWeight: 500 }}>{value}</dd>
    </div>
  );
}
