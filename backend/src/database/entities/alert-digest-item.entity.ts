import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { AlertDigestEntity } from './alert-digest.entity';
import { CandidateEntity } from './candidate.entity';

/**
 * A New Mention listed in an Alert Digest. Re-processing a company deletes its
 * Candidates, and with them their digest entries (ADR-010: history is replaced).
 */
@Entity({ name: 'alert_digest_items' })
@Index('IDX_alert_digest_items_candidate', ['candidateId'])
export class AlertDigestItemEntity {
  @PrimaryColumn({ name: 'digest_id', type: 'integer', primaryKeyConstraintName: 'PK_alert_digest_items' })
  digestId!: number;

  @PrimaryColumn({ name: 'candidate_id', type: 'integer', primaryKeyConstraintName: 'PK_alert_digest_items' })
  candidateId!: number;

  @ManyToOne(() => AlertDigestEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'digest_id', foreignKeyConstraintName: 'FK_alert_digest_items_digest' })
  digest?: AlertDigestEntity;

  @ManyToOne(() => CandidateEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id', foreignKeyConstraintName: 'FK_alert_digest_items_candidate' })
  candidate?: CandidateEntity;
}
