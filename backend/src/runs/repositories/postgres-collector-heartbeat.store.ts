import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CollectorHeartbeatEntity } from '../../database/entities/collector-heartbeat.entity';
import type { CollectorHeartbeat, CollectorHeartbeatStore } from '../collector-heartbeat';

/** The table holds a single row, always with this id. */
const HEARTBEAT_ROW_ID = 1;

/** The heartbeat in the single-row `collector_heartbeat` table. */
@Injectable()
export class PostgresCollectorHeartbeatStore implements CollectorHeartbeatStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async record(heartbeat: CollectorHeartbeat): Promise<void> {
    await this.dataSource
      .getRepository(CollectorHeartbeatEntity)
      .upsert({ id: HEARTBEAT_ROW_ID, ...heartbeat }, ['id']);
  }

  async latest(): Promise<CollectorHeartbeat | null> {
    const row = await this.dataSource
      .getRepository(CollectorHeartbeatEntity)
      .findOne({ where: { id: HEARTBEAT_ROW_ID } });
    if (row === null) return null;
    return {
      lastSeenAt: row.lastSeenAt,
      state: row.state,
      ollamaOk: row.ollamaOk,
      ollamaModel: row.ollamaModel,
      detail: row.detail,
    };
  }
}
