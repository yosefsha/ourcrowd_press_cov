import type { CollectorState } from '../../domain/collector-state';
import type { CollectorHealth } from '../collector-health.service';

/** `GET /api/collector/health` */
export class CollectorHealthDto {
  /** The heartbeat is recent enough to count the collector as running. */
  readonly online!: boolean;
  /** Null when the collector has never reported. */
  readonly lastSeenAt!: string | null;
  readonly state!: CollectorState | null;
  readonly ollamaOk!: boolean | null;
  readonly ollamaModel!: string | null;
  readonly detail!: string | null;

  static from(health: CollectorHealth): CollectorHealthDto {
    const heartbeat = health.heartbeat;
    return Object.assign(new CollectorHealthDto(), {
      online: health.online,
      lastSeenAt: heartbeat?.lastSeenAt.toISOString() ?? null,
      state: heartbeat?.state ?? null,
      ollamaOk: heartbeat?.ollamaOk ?? null,
      ollamaModel: heartbeat?.ollamaModel ?? null,
      detail: heartbeat?.detail ?? null,
    });
  }
}
