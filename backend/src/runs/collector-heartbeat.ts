import type { CollectorState } from '../domain/collector-state';

/** Injection token for the `CollectorHeartbeatStore` port. */
export const COLLECTOR_HEARTBEAT_STORE = Symbol('COLLECTOR_HEARTBEAT_STORE');

/** The collector's latest report of itself and of the classification model. */
export interface CollectorHeartbeat {
  readonly lastSeenAt: Date;
  readonly state: CollectorState;
  /** Null when the model's health is not known. */
  readonly ollamaOk: boolean | null;
  readonly ollamaModel: string | null;
  readonly detail: string | null;
}

/** Where the collector's heartbeat is kept: written by the collector, read by the API. */
export interface CollectorHeartbeatStore {
  /** Replaces the heartbeat. */
  record(heartbeat: CollectorHeartbeat): Promise<void>;
  /** The latest heartbeat; null if the collector has never reported. */
  latest(): Promise<CollectorHeartbeat | null>;
}
