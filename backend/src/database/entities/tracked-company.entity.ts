import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TRACKED_COMPANY_STATUSES, type TrackedCompanyStatus } from '../../domain/company';

/** A Tracked Company and its Company Profile (ADR-010). */
@Entity({ name: 'tracked_companies' })
@Index('UQ_tracked_companies_source_name', ['sourceName'], {
  unique: true,
  where: '"source_name" IS NOT NULL',
})
// Unique lower(display_name) among companies that are not deactivated. An
// expression index TypeORM cannot describe; it lives in the migration only.
@Index('UQ_tracked_companies_display_name_live', { synchronize: false })
@Index('IDX_tracked_companies_status', ['status'])
export class TrackedCompanyEntity {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'BY DEFAULT',
    primaryKeyConstraintName: 'PK_tracked_companies',
  })
  id!: number;

  /** The exact Seed List line; null for companies added by hand. */
  @Column({ name: 'source_name', type: 'text', nullable: true })
  sourceName!: string | null;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  aliases!: string[];

  @Column({ type: 'text', nullable: true })
  domain!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'search_terms', type: 'text', array: true, default: () => "'{}'" })
  searchTerms!: string[];

  @Column({ type: 'enum', enum: TRACKED_COMPANY_STATUSES, enumName: 'tracked_company_status' })
  status!: TrackedCompanyStatus;

  @Column({ name: 'review_reason', type: 'text', nullable: true })
  reviewReason!: string | null;

  /** The last collection hit the News Source's result cap or MAX_CANDIDATES_PER_COMPANY. */
  @Column({ name: 'coverage_capped', type: 'boolean', default: false })
  coverageCapped!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
