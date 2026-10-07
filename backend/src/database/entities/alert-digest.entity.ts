import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { RunEntity } from './run.entity';

/** The Alert Digest of one Daily Check; shown in the dashboard until acknowledged (ADR-004). */
@Entity({ name: 'alert_digests' })
@Unique('UQ_alert_digests_run', ['runId'])
@Index('IDX_alert_digests_unacknowledged', ['createdAt'], { where: '"acknowledged_at" IS NULL' })
export class AlertDigestEntity {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'BY DEFAULT',
    primaryKeyConstraintName: 'PK_alert_digests',
  })
  id!: number;

  @Column({ name: 'run_id', type: 'integer' })
  runId!: number;

  // ManyToOne + the unique constraint above: OneToOne would add a second, duplicate one.
  @ManyToOne(() => RunEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_alert_digests_run' })
  run?: RunEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;
}
