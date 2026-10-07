import { articleHref, describeDigest, orderDigestGroups } from '../alertDigests.ts';
import { useAcknowledgeAlertMutation, useAlertQuery } from '../queries.ts';
import { requestErrorMessage } from '../requestErrorMessage.ts';
import { formatDateTime } from '../runs.ts';
import type { AlertDigestSummary, Sentiment } from '../types.ts';

interface Props {
  digest: AlertDigestSummary;
}

const SENTIMENT_STYLES: Readonly<Record<Sentiment, React.CSSProperties>> = {
  negative: { background: '#ffe3e3', color: '#b42318' },
  positive: { background: '#e3f9e5', color: '#1f7a35' },
  neutral: { background: '#f0f4f8', color: '#486581' },
};

/** One Alert Digest: its New Mentions grouped by company, negatives first, and an Acknowledge button. */
export function AlertDigestCard({ digest }: Props): React.JSX.Element {
  const detail = useAlertQuery(digest.id);
  const acknowledge = useAcknowledgeAlertMutation();
  const headingId = `alert-digest-${digest.id}`;

  return (
    <article
      aria-labelledby={headingId}
      style={{ border: '1px solid #d9e2ec', borderRadius: 6, padding: 12, display: 'grid', gap: 8 }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h3 id={headingId} style={{ fontSize: 14, margin: 0 }}>
          Daily Check of {formatDateTime(digest.createdAt)}
        </h3>
        <span style={{ fontSize: 13, color: digest.negativeMentionCount > 0 ? '#b42318' : '#486581' }}>
          {describeDigest(digest)}
        </span>
      </header>

      {detail.isError ? (
        <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 13 }}>
          Could not load this digest: {requestErrorMessage(detail.error)}
        </p>
      ) : detail.data === undefined ? (
        <p style={{ margin: 0, fontSize: 13 }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {orderDigestGroups(detail.data.companies).map((group) => (
            <section key={group.companyId} aria-label={group.displayName}>
              <h4 style={{ fontSize: 13, margin: '0 0 4px' }}>{group.displayName}</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
                {group.mentions.map((mention) => {
                  const href = articleHref(mention.article);
                  return (
                    <li key={mention.candidateId} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 13 }}>
                      <span
                        style={{
                          ...SENTIMENT_STYLES[mention.sentiment],
                          borderRadius: 4,
                          padding: '0 6px',
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        {mention.sentiment}
                      </span>
                      <span>
                        {href === null ? (
                          mention.article.title
                        ) : (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            {mention.article.title}
                          </a>
                        )}{' '}
                        <span style={{ color: '#627d98' }}>— {mention.article.outletName}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {acknowledge.isError ? (
        <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 13 }}>
          Could not acknowledge: {requestErrorMessage(acknowledge.error)}
        </p>
      ) : null}
      <div>
        <button
          type="button"
          disabled={acknowledge.isPending}
          onClick={() => {
            acknowledge.mutate(digest.id);
          }}
          style={{ padding: '4px 12px', fontSize: 13 }}
        >
          {acknowledge.isPending ? 'Acknowledging…' : 'Acknowledge'}
        </button>
      </div>
    </article>
  );
}
