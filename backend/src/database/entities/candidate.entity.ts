import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { RELEVANCE_METHODS, RELEVANCES, type Relevance, type RelevanceMethod } from '../../domain/relevance';
import { SENTIMENTS, type Sentiment } from '../../domain/sentiment';
import { ArticleEntity } from './article.entity';
import { RunEntity } from './run.entity';
import { TrackedCompanyEntity } from './tracked-company.entity';

/**
 * An Article returned for one Tracked Company, with its Relevance Verdict and,
 * once relevant, its Sentiment. A Mention is a Candidate with
 * `relevance = 'relevant'` (ADR-002, ADR-008).
 */
@Entity({ name: 'candidates' })
@Unique('UQ_candidates_article_company', ['articleId', 'companyId'])
@Index('IDX_candidates_company_relevance', ['companyId', 'relevance'])
@Index('IDX_candidates_confirmed_in_run', ['confirmedInRunId'])
@Check('CHK_candidates_method_iff_judged', `("relevance" = 'pending') = ("relevance_method" IS NULL)`)
@Check(
  'CHK_candidates_only_mentions_confirmed',
  `"relevance" = 'relevant' OR ("sentiment" IS NULL AND "confirmed_in_run_id" IS NULL AND "confirmed_at" IS NULL)`,
)
export class CandidateEntity {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'BY DEFAULT',
    primaryKeyConstraintName: 'PK_candidates',
  })
  id!: number;

  @Column({ name: 'article_id', type: 'integer' })
  articleId!: number;

  @ManyToOne(() => ArticleEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'article_id', foreignKeyConstraintName: 'FK_candidates_article' })
  article?: ArticleEntity;

  @Column({ name: 'company_id', type: 'integer' })
  companyId!: number;

  @ManyToOne(() => TrackedCompanyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id', foreignKeyConstraintName: 'FK_candidates_company' })
  company?: TrackedCompanyEntity;

  @Column({ name: 'fetched_in_run_id', type: 'integer' })
  fetchedInRunId!: number;

  @ManyToOne(() => RunEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fetched_in_run_id', foreignKeyConstraintName: 'FK_candidates_fetched_in_run' })
  fetchedInRun?: RunEntity;

  @Column({ type: 'enum', enum: RELEVANCES, enumName: 'candidate_relevance', default: 'pending' })
  relevance!: Relevance;

  @Column({ name: 'relevance_method', type: 'enum', enum: RELEVANCE_METHODS, enumName: 'relevance_method', nullable: true })
  relevanceMethod!: RelevanceMethod | null;

  @Column({ name: 'relevance_reason', type: 'text', nullable: true })
  relevanceReason!: string | null;

  @Column({ name: 'relevance_classified_at', type: 'timestamptz', nullable: true })
  relevanceClassifiedAt!: Date | null;

  @Column({ type: 'enum', enum: SENTIMENTS, enumName: 'sentiment', nullable: true })
  sentiment!: Sentiment | null;

  @Column({ name: 'sentiment_reason', type: 'text', nullable: true })
  sentimentReason!: string | null;

  @Column({ name: 'sentiment_classified_at', type: 'timestamptz', nullable: true })
  sentimentClassifiedAt!: Date | null;

  /** The Run that confirmed this Candidate as a Mention — what makes it a New Mention (ADR-004). */
  @Column({ name: 'confirmed_in_run_id', type: 'integer', nullable: true })
  confirmedInRunId!: number | null;

  @ManyToOne(() => RunEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'confirmed_in_run_id', foreignKeyConstraintName: 'FK_candidates_confirmed_in_run' })
  confirmedInRun?: RunEntity | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
