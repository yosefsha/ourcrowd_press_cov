import { useId, useState } from 'react';

import { useCompanyCandidatesQuery } from '../queries.ts';
import type { Candidate, CoverageWindow } from '../types.ts';
import { CandidateRow } from './CandidateRow.tsx';
import { CandidatePagination } from './CandidatePagination.tsx';
import { CANDIDATES_PAGE_SIZE, pageCount } from './companyDetailData.ts';

interface Props {
  companyId: number;
  coverageWindow: CoverageWindow;
}

/**
 * Paginated Mentions of one Tracked Company, optionally with its rejected
 * Candidates. Render it with a `key` per company and window so paging restarts.
 */
export function CandidateList({ companyId, coverageWindow }: Props): React.JSX.Element {
  const toggleId = useId();
  const [showRejected, setShowRejected] = useState(false);
  const [page, setPage] = useState(1);
  const query = useCompanyCandidatesQuery(companyId, {
    window: coverageWindow,
    include: showRejected ? 'all' : 'mentions',
    page,
    pageSize: CANDIDATES_PAGE_SIZE,
  });

  const handleToggle = (checked: boolean): void => {
    setShowRejected(checked);
    setPage(1);
  };

  return (
    <section aria-labelledby="candidate-list-heading" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 id="candidate-list-heading" style={{ margin: 0, fontSize: 15 }}>
          {showRejected ? 'Mentions and rejected Candidates' : 'Mentions'}
        </h3>
        <label htmlFor={toggleId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            id={toggleId}
            type="checkbox"
            checked={showRejected}
            onChange={(event) => {
              handleToggle(event.target.checked);
            }}
          />
          Show rejected Candidates
        </label>
      </div>
      {renderBody(query.status, query.error, query.data?.items ?? [], showRejected)}
      {query.data === undefined ? null : (
        <CandidatePagination
          page={query.data.page}
          totalPages={pageCount(query.data.total, query.data.pageSize)}
          total={query.data.total}
          onChange={setPage}
        />
      )}
    </section>
  );
}

function renderBody(
  status: 'pending' | 'error' | 'success',
  error: Error | null,
  items: readonly Candidate[],
  showRejected: boolean,
): React.JSX.Element {
  if (status === 'pending') return <p style={mutedStyle}>Loading Mentions…</p>;
  if (status === 'error') {
    return (
      <p role="alert" style={{ margin: 0, color: '#ab091e' }}>
        Could not load Mentions: {error?.message ?? 'unknown error'}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p style={mutedStyle}>
        {showRejected ? 'No Candidates in this Coverage Window.' : 'No Mentions in this Coverage Window.'}
      </p>
    );
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {items.map((candidate) => (
        <CandidateRow key={candidate.id} candidate={candidate} />
      ))}
    </ul>
  );
}

const mutedStyle: React.CSSProperties = { margin: 0, color: '#627d98' };
