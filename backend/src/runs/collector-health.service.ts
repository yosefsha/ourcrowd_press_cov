import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { COLLECTOR_HEARTBEAT_STORE, type CollectorHeartbeat, type CollectorHeartbeatStore } from './collector-heartbeat';

/** A heartbeat older than this many poll intervals means the collector is offline. */
export const OFFLINE_AFTER_POLL_INTERVALS = 3;

export interface CollectorHealth {
  readonly online: boolean;
  readonly heartbeat: CollectorHeartbeat | null;
}

/** Whether the collector is alive, judged from its heartbeat (ADR-009). */
@Injectable()
export class CollectorHealthService {
  private readonly staleAfterMs: number;

  constructor(
    @Inject(COLLECTOR_HEARTBEAT_STORE) private readonly heartbeats: CollectorHeartbeatStore,
    config: ConfigService<AppConfig, true>,
  ) {
    this.staleAfterMs = OFFLINE_AFTER_POLL_INTERVALS * config.get('runs.pollIntervalMs', { infer: true });
  }

  async health(now: Date = new Date()): Promise<CollectorHealth> {
    const heartbeat = await this.heartbeats.latest();
    const online = heartbeat !== null && now.getTime() - heartbeat.lastSeenAt.getTime() <= this.staleAfterMs;
    return { online, heartbeat };
  }
}
