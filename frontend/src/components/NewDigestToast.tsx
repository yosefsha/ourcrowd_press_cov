import { describeDigest } from '../alertDigests.ts';
import type { AlertDigestSummary } from '../types.ts';

interface Props {
  digests: readonly AlertDigestSummary[];
  onOpen: () => void;
  onDismiss: () => void;
}

/** In-app notification for Alert Digests that arrived while the dashboard was open. */
export function NewDigestToast({ digests, onOpen, onDismiss }: Props): React.JSX.Element | null {
  if (digests.length === 0) return null;
  const negative = digests.some((digest) => digest.negativeMentionCount > 0);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 1000,
        maxWidth: 360,
        background: '#ffffff',
        border: `1px solid ${negative ? '#f04438' : '#d9e2ec'}`,
        borderLeft: `4px solid ${negative ? '#f04438' : '#2563eb'}`,
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(16, 42, 67, 0.15)',
        padding: 12,
        display: 'grid',
        gap: 8,
        fontSize: 14,
      }}
    >
      <strong>{digests.length === 1 ? 'New Alert Digest' : `${digests.length} new Alert Digests`}</strong>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {digests.map((digest) => (
          <li key={digest.id}>{describeDigest(digest)}</li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onOpen} style={{ padding: '4px 12px', fontSize: 13 }}>
          View alerts
        </button>
        <button type="button" onClick={onDismiss} style={{ padding: '4px 12px', fontSize: 13 }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
