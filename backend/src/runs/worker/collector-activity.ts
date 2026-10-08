import { Injectable } from '@nestjs/common';

import type { CollectorState } from '../../domain/collector-state';

/** What the collector is doing right now, as its heartbeat reports it. */
@Injectable()
export class CollectorActivity {
  private current: CollectorState = 'idle';

  get state(): CollectorState {
    return this.current;
  }

  set(state: CollectorState): void {
    this.current = state;
  }
}
