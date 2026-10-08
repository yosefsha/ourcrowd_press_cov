import { useRunQuery } from '../queries.ts';
import { requestErrorMessage } from '../requestErrorMessage.ts';
import type { RunStage } from '../types.ts';

interface Props {
  runId: number;
}

const STAGE_LABELS: Readonly<Record<RunStage, string>> = {
  collection: 'Collection',
  relevance: 'Relevance',
  sentiment: 'Sentiment',
};

/** The per-company errors one Run recorded, loaded when first shown. */
export function RunCompanyErrorList({ runId }: Props): React.JSX.Element {
  const detail = useRunQuery(runId);

  if (detail.error !== null) {
    return (
      <p role="alert" style={{ margin: '4px 0 0', color: '#b42318' }}>
        Could not load the company errors: {requestErrorMessage(detail.error)}
      </p>
    );
  }
  if (detail.data === undefined) return <p style={{ margin: '4px 0 0' }}>Loading…</p>;
  if (detail.data.companyErrors.length === 0) return <p style={{ margin: '4px 0 0' }}>No company errors recorded.</p>;

  return (
    <ul aria-label={`Company errors in Run #${runId}`} style={{ margin: '4px 0 0', paddingLeft: 18, color: '#334e68' }}>
      {detail.data.companyErrors.map((error, index) => (
        <li key={`${error.companyId}-${error.stage}-${index}`}>
          <strong>{error.companyName}</strong> · {STAGE_LABELS[error.stage]}:{' '}
          <span style={{ whiteSpace: 'pre-wrap' }}>{error.message}</span>
        </li>
      ))}
    </ul>
  );
}
