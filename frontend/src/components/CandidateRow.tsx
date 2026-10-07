import type { Candidate } from '../types.ts';
import { articleHref, candidateReason, formatDate } from './companyDetailData.ts';
import { VerdictBadge } from './VerdictBadge.tsx';

interface Props {
  candidate: Candidate;
}

/** One Mention or rejected Candidate: date, Outlet, linked headline, language, verdict badge and reason. */
export function CandidateRow({ candidate }: Props): React.JSX.Element {
  const { article } = candidate;
  const href = articleHref(article);
  const reason = candidateReason(candidate);

  return (
    <li style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0', borderBottom: '1px solid #e4e7eb' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12, color: '#627d98' }}>
        <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
        <span>·</span>
        <span>{article.outletName}</span>
        <span
          title="Language"
          style={{ border: '1px solid #bcccdc', borderRadius: 4, padding: '0 4px', textTransform: 'uppercase' }}
        >
          {article.language}
        </span>
        <VerdictBadge candidate={candidate} />
      </div>
      {href === null ? (
        <span style={{ fontSize: 14, fontWeight: 500 }}>{article.title}</span>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 500 }}>
          {article.title}
        </a>
      )}
      {reason === null ? null : <p style={{ margin: 0, fontSize: 13, color: '#486581' }}>{reason}</p>}
    </li>
  );
}
