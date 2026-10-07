import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import {
  RUN_STATUSES,
  RUN_TRIGGERS,
  RUN_TYPES,
  type RunParams,
  type RunProgress,
  type RunStatus,
  type RunTrigger,
  type RunType,
} from '../../domain/run';

/** One execution of a Backfill or a Daily Check; the `runs` table is the queue (ADR-009). */
@Entity({ name: 'runs' })
// At most one Run queued or running: a unique index over a constant, limited
// to active rows. An expression index, so it lives in the migration only.
@Index('UQ_runs_one_active', { synchronize: false })
@Index('IDX_runs_created_at', ['createdAt'])
export class RunEntity {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'BY DEFAULT',
    primaryKeyConstraintName: 'PK_runs',
  })
  id!: number;

  @Column({ type: 'enum', enum: RUN_TYPES, enumName: 'run_type' })
  type!: RunType;

  @Column({ type: 'enum', enum: RUN_STATUSES, enumName: 'run_status', default: 'queued' })
  status!: RunStatus;

  @Column({ type: 'jsonb' })
  params!: RunParams;

  @Column({ type: 'enum', enum: RUN_TRIGGERS, enumName: 'run_trigger' })
  trigger!: RunTrigger;

  @Column({ type: 'jsonb', nullable: true })
  progress!: RunProgress | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
