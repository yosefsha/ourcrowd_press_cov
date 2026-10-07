import type { ReactNode } from 'react';

import { MENTION_STATUS_LABELS } from '../coverageFormat.ts';
import { MENTION_STATUSES, type CoverageSummary, type MentionStatus } from '../types.ts';
import { SentimentBar } from './SentimentBar.tsx';

interface Props {
  summary: CoverageSummary;
  /** The Mention Status the table is filtered to, if any. */
  selectedStatus: MentionStatus | null;
  /** Whether the table is filtered to companies with negative Mentions. */
  hasNegatives: boolean;
  onSelectStatus: (status: MentionStatus | null) => void;
  onToggleNegatives: (hasNegatives: boolean) => void;
}

interface TileProps {
  label: string;
  children: ReactNode;
  /** Present when the tile filters the table; the tile then renders as a toggle button. */
  pressed?: boolean;
  onClick?: () => void;
}

const tileStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 120,
  padding: '12px 16px',
  background: '#ffffff',
  border: '1px solid #d9e2ec',
  borderRadius: 8,
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
};

function Tile({ label, children, pressed, onClick }: TileProps): React.JSX.Element {
  const content = (
    <>
      <span style={{ fontSize: 12, color: '#486581' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 600 }}>{children}</span>
    </>
  );
  if (onClick === undefined) return <div style={tileStyle}>{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={pressed === true}
      onClick={onClick}
      style={{
        ...tileStyle,
        cursor: 'pointer',
        borderColor: pressed === true ? '#2680c2' : '#d9e2ec',
        boxShadow: pressed === true ? '0 0 0 1px #2680c2' : 'none',
      }}
    >
      {content}
    </button>
  );
}

/**
 * Totals for the Coverage Window above the company table. The status and
 * negative-Mention tiles double as filters for the table.
 */
export function SummaryStrip({
  summary,
  selectedStatus,
  hasNegatives,
  onSelectStatus,
  onToggleNegatives,
}: Props): React.JSX.Element {
  const { sentiment } = summary;
  return (
    <section aria-label="Summary" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {MENTION_STATUSES.map((status) => (
        <Tile
          key={status}
          label={MENTION_STATUS_LABELS[status]}
          pressed={selectedStatus === status}
          onClick={() => {
            onSelectStatus(selectedStatus === status ? null : status);
          }}
        >
          {summary.companiesByMentionStatus[status]}
        </Tile>
      ))}
      <Tile label="Mentions in window">{summary.mentionCount}</Tile>
      <Tile label="Sentiment">
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 400 }}>
          <SentimentBar sentiment={sentiment} width={160} />
          <span>
            {sentiment.positive} positive · {sentiment.negative} negative · {sentiment.neutral} neutral
          </span>
        </span>
      </Tile>
      <Tile
        label="Negative Mentions in window"
        pressed={hasNegatives}
        onClick={() => {
          onToggleNegatives(!hasNegatives);
        }}
      >
        <span style={{ color: sentiment.negative > 0 ? '#ab091e' : 'inherit' }}>{sentiment.negative}</span>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: '#486581' }}>
          across {summary.companiesWithNegativeMentions}{' '}
          {summary.companiesWithNegativeMentions === 1 ? 'company' : 'companies'}
        </span>
      </Tile>
    </section>
  );
}
