import type { MentionStatus } from '../../domain/mention-status';
import type { SentimentCounts } from '../coverage-read-model';

/** `GET /api/summary` — the summary strip for one Coverage Window. */
export class CoverageSummaryDto {
  readonly window!: string;
  /** ISO-8601; inclusive start and exclusive end of the resolved window. */
  readonly from!: string;
  readonly to!: string;
  /** When the most recent completed Run finished; null before the first one. */
  readonly asOf!: string | null;
  /** Earliest moment collection covers (first Backfill's window start or first Candidate fetch); null before any. */
  readonly collectionStartedAt!: string | null;
  /** Active Tracked Companies per Mention Status, as of now. */
  readonly companiesByMentionStatus!: Readonly<Record<MentionStatus, number>>;
  readonly mentionCount!: number;
  readonly sentiment!: SentimentCounts;
  readonly companiesWithNegativeMentions!: number;

  constructor(fields: CoverageSummaryDto) {
    Object.assign(this, fields);
  }
}
