import type { CompanyProfile, TrackedCompanyStatus } from '../../domain/company';
import type { MentionStatus } from '../../domain/mention-status';
import type { SentimentCounts } from '../coverage-read-model';
import type { WeeklySentimentPointDto } from './weekly-sentiment-point.dto';

/** `GET /api/companies/:id`. */
export class CompanyDetailDto {
  readonly id!: number;
  readonly sourceName!: string | null;
  readonly status!: TrackedCompanyStatus;
  readonly profile!: CompanyProfile;
  readonly window!: string;
  readonly mentionStatus!: MentionStatus;
  readonly lastMentionAt!: string | null;
  readonly mentionCount!: number;
  readonly capped!: boolean;
  readonly sentiment!: SentimentCounts;
  /** Contiguous weeks covering the window, empty weeks as zeros. */
  readonly weeklySeries!: readonly WeeklySentimentPointDto[];
  /** Rejected share of classified Candidates in the window, 0–1; null with none. */
  readonly rejectionRate!: number | null;

  constructor(fields: CompanyDetailDto) {
    Object.assign(this, fields);
  }
}
