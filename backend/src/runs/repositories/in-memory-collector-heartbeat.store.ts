import type { CollectorHeartbeat, CollectorHeartbeatStore } from '../collector-heartbeat';

/** In-memory heartbeat for tests. */
export class InMemoryCollectorHeartbeatStore implements CollectorHeartbeatStore {
  private current: CollectorHeartbeat | null;

  constructor(initial: CollectorHeartbeat | null = null) {
    this.current = initial;
  }

  record(heartbeat: CollectorHeartbeat): Promise<void> {
    this.current = heartbeat;
    return Promise.resolve();
  }

  latest(): Promise<CollectorHeartbeat | null> {
    return Promise.resolve(this.current);
  }
}
