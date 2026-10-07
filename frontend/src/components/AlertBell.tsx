import { useId, useState } from 'react';

import { findUnseenDigests } from '../alertDigests.ts';
import { useAlertsQuery } from '../queries.ts';
import { requestErrorMessage } from '../requestErrorMessage.ts';
import type { AlertDigestSummary, AlertsQuery } from '../types.ts';
import { AlertDigestCard } from './AlertDigestCard.tsx';
import { NewDigestToast } from './NewDigestToast.tsx';

/** The bell lists only digests nobody has acknowledged yet. */
const UNACKNOWLEDGED: AlertsQuery = { acknowledged: false };

/**
 * Alert bell in the top bar: the count of unacknowledged Alert Digests (polled),
 * a panel listing them, and a notification when a new one arrives while the
 * dashboard is open.
 */
export function AlertBell(): React.JSX.Element {
  const panelId = useId();
  const alerts = useAlertsQuery(UNACKNOWLEDGED);
  const [open, setOpen] = useState(false);
  // Digest ids already known to this page; null until the first list arrives,
  // so digests that existed before the page loaded never pop a notification.
  const [seenIds, setSeenIds] = useState<ReadonlySet<number> | null>(null);
  const [arrivals, setArrivals] = useState<readonly AlertDigestSummary[]>([]);

  // Derive "new since last render" from the polled list while rendering (React's
  // pattern for adjusting state to changed data), rather than in an effect.
  const digests = alerts.data;
  if (digests !== undefined) {
    if (seenIds === null) {
      setSeenIds(new Set(digests.map((digest) => digest.id)));
    } else {
      const unseen = findUnseenDigests(seenIds, digests);
      if (unseen.length > 0) {
        setSeenIds(new Set([...seenIds, ...unseen.map((digest) => digest.id)]));
        setArrivals((previous) => [...previous, ...unseen]);
      }
    }
  }

  const count = digests?.length ?? 0;
  const label = alerts.isError
    ? 'Alerts (could not load)'
    : `Alerts, ${count} unacknowledged ${count === 1 ? 'digest' : 'digests'}`;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((value) => !value);
        }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          fontSize: 14,
          background: '#ffffff',
          border: '1px solid #bcccdc',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span aria-hidden="true">Alerts</span>
        {alerts.isError ? (
          <span aria-hidden="true" style={{ color: '#b42318', fontWeight: 700 }}>
            !
          </span>
        ) : count > 0 ? (
          <span
            aria-hidden="true"
            style={{ background: '#d64545', color: '#ffffff', borderRadius: 10, padding: '0 6px', fontSize: 12, fontWeight: 700 }}
          >
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Alert Digests"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 900,
            width: 'min(480px, 90vw)',
            maxHeight: '70vh',
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid #d9e2ec',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(16, 42, 67, 0.15)',
            padding: 12,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Alert Digests</h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
              }}
              style={{ padding: '2px 8px', fontSize: 13 }}
            >
              Close
            </button>
          </div>
          {alerts.isError ? (
            <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 14 }}>
              Could not load Alert Digests: {requestErrorMessage(alerts.error)}
            </p>
          ) : digests === undefined ? (
            <p style={{ margin: 0, fontSize: 14 }}>Loading…</p>
          ) : digests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14 }}>No unacknowledged Alert Digests.</p>
          ) : (
            digests.map((digest) => <AlertDigestCard key={digest.id} digest={digest} />)
          )}
        </div>
      ) : null}

      <NewDigestToast
        digests={arrivals}
        onOpen={() => {
          setArrivals([]);
          setOpen(true);
        }}
        onDismiss={() => {
          setArrivals([]);
        }}
      />
    </div>
  );
}
