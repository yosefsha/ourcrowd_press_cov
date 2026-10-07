import type { Candidate } from '../types.ts';
import { RELEVANCE_METHOD_LABELS, SENTIMENT_COLORS, SENTIMENT_LABELS } from './companyDetailData.ts';

interface Props {
  candidate: Pick<Candidate, 'relevance' | 'relevanceMethod' | 'sentiment'>;
}

const MUTED_DOT = '#7b8794';

/**
 * The Candidate's verdict — Sentiment for a Mention, "Rejected · <method>" for a
 * rejected Candidate — as a colored dot beside a text label, never color alone.
 */
export function VerdictBadge({ candidate }: Props): React.JSX.Element {
  const { label, color } = describeVerdict(candidate);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#334e68', fontWeight: 500 }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

function describeVerdict(candidate: Props['candidate']): { label: string; color: string } {
  switch (candidate.relevance) {
    case 'relevant':
      return candidate.sentiment === null
        ? { label: 'Mention', color: MUTED_DOT }
        : { label: SENTIMENT_LABELS[candidate.sentiment], color: SENTIMENT_COLORS[candidate.sentiment] };
    case 'rejected': {
      const method = candidate.relevanceMethod === null ? '' : ` · ${RELEVANCE_METHOD_LABELS[candidate.relevanceMethod]}`;
      return { label: `Rejected${method}`, color: MUTED_DOT };
    }
    case 'pending':
      return { label: 'Pending', color: MUTED_DOT };
  }
}
