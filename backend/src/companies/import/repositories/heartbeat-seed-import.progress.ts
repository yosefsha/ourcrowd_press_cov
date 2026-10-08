import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CollectorHeartbeatEntity } from '../../../database/entities/collector-heartbeat.entity';
import type { CollectorState } from '../../../domain/collector-state';
import type { SeedImportProgress, SeedImportProgressSnapshot } from '../seed-import-progress';

const HEARTBEAT_ID = 1;

/**
 * Publishes the import on the collector's single heartbeat row: state
 * `importing` with the count in `detail` while it runs, back to `idle` when it
 * stops. Ollama health columns are left to the Run worker's heartbeat.
 */
@Injectable()
export class HeartbeatSeedImportProgress implements SeedImportProgress {
  constructor(
    @InjectRepository(CollectorHeartbeatEntity)
    private readonly heartbeat: Repository<CollectorHeartbeatEntity>,
  ) {}

  importing(progress: SeedImportProgressSnapshot): Promise<void> {
    return this.write('importing', `Importing the Seed List: ${progress.imported} of ${progress.total} companies`);
  }

  stopped(detail: string | null): Promise<void> {
    return this.write('idle', detail);
  }

  private async write(state: CollectorState, detail: string | null): Promise<void> {
    await this.heartbeat.upsert({ id: HEARTBEAT_ID, lastSeenAt: new Date(), state, detail }, ['id']);
  }
}
