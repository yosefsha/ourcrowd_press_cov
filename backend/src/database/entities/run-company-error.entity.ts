import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { RunStage } from '../../domain/run';
import { RunEntity } from './run.entity';
import { TrackedCompanyEntity } from './tracked-company.entity';

/** One company's failure inside a Run that otherwise carried on. */
@Entity({ name: 'run_company_errors' })
@Index('IDX_run_company_errors_run', ['runId'])
export class RunCompanyErrorEntity {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'BY DEFAULT',
    primaryKeyConstraintName: 'PK_run_company_errors',
  })
  id!: number;

  @Column({ name: 'run_id', type: 'integer' })
  runId!: number;

  @ManyToOne(() => RunEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_run_company_errors_run' })
  run?: RunEntity;

  @Column({ name: 'company_id', type: 'integer' })
  companyId!: number;

  @ManyToOne(() => TrackedCompanyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_run_company_errors_company' })
  company?: TrackedCompanyEntity;

  /** Text rather than an enum so a new pipeline stage needs no migration. */
  @Column({ type: 'text' })
  stage!: RunStage;

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
