import { requestErrorMessage } from '../requestErrorMessage.ts';
import { COLLECTOR_STATE_LABELS, formatDateTime } from '../runs.ts';
import type { CollectorHealth } from '../types.ts';

interface Props {
  health: CollectorHealth | undefined;
  error: Error | null;
}

function healthBadge(ok: boolean | null, text: string): React.JSX.Element {
  const palette =
    ok === null
      ? { background: '#f0f4f8', color: '#486581' }
      : ok
        ? { background: '#e3f9e5', color: '#1f7a35' }
        : { background: '#ffe3e3', color: '#b42318' };
  return (
    <span style={{ ...palette, borderRadius: 4, padding: '2px 8px', fontSize: 13, fontWeight: 600 }}>{text}</span>
  );
}

const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, fontSize: 14 };

/** The collector heartbeat: online/offline, what it is doing, and whether Ollama answers. */
export function CollectorHealthPanel({ health, error }: Props): React.JSX.Element {
  if (error !== null) {
    return (
      <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 14 }}>
        Could not load collector health: {requestErrorMessage(error)}
      </p>
    );
  }
  if (health === undefined) return <p style={{ margin: 0, fontSize: 14 }}>Loading…</p>;

  return (
    <dl aria-label="Collector health" style={{ display: 'grid', gap: 8, margin: 0 }}>
      <div style={rowStyle}>
        <dt>Collector</dt>
        <dd style={{ margin: 0 }}>
          {healthBadge(health.online, health.online ? 'Online' : 'Offline')}
          <span style={{ marginLeft: 8, color: '#627d98' }}>
            {health.lastSeenAt === null ? 'never reported' : `last seen ${formatDateTime(health.lastSeenAt)}`}
          </span>
        </dd>
      </div>
      <div style={rowStyle}>
        <dt>State</dt>
        <dd style={{ margin: 0 }}>{health.state === null ? 'Unknown' : COLLECTOR_STATE_LABELS[health.state]}</dd>
      </div>
      <div style={rowStyle}>
        <dt>Ollama</dt>
        <dd style={{ margin: 0 }}>
          {healthBadge(
            health.ollamaOk,
            health.ollamaOk === null ? 'Unknown' : health.ollamaOk ? 'Reachable' : 'Unreachable',
          )}
        </dd>
      </div>
      <div style={rowStyle}>
        <dt>Model</dt>
        <dd style={{ margin: 0 }}>{health.ollamaModel ?? 'Unknown'}</dd>
      </div>
      {health.detail === null ? null : (
        <div style={rowStyle}>
          <dt>Detail</dt>
          <dd style={{ margin: 0 }}>{health.detail}</dd>
        </div>
      )}
    </dl>
  );
}
