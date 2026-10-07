import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

import { COLLECTOR_STATES, type CollectorState } from '../../domain/collector-state';

/** The collector's single heartbeat row, carrying its state and Ollama health (ADR-009). */
@Entity({ name: 'collector_heartbeat' })
@Check('CHK_collector_heartbeat_single_row', '"id" = 1')
export class CollectorHeartbeatEntity {
  /** Always 1: the table holds one row. */
  @PrimaryColumn({ type: 'smallint', default: 1, primaryKeyConstraintName: 'PK_collector_heartbeat' })
  id!: number;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;

  @Column({ type: 'enum', enum: COLLECTOR_STATES, enumName: 'collector_state' })
  state!: CollectorState;

  /** Null until the collector has probed Ollama. */
  @Column({ name: 'ollama_ok', type: 'boolean', nullable: true })
  ollamaOk!: boolean | null;

  @Column({ name: 'ollama_model', type: 'text', nullable: true })
  ollamaModel!: string | null;

  @Column({ type: 'text', nullable: true })
  detail!: string | null;
}
