import type { MentionStatus } from '../../domain/mention-status';
import type { SentimentCounts } from '../coverage-read-model';
import type { HeadlineDto } from './headline.dto';

/** One row of `GET /api/companies`. */
export class CompanyOverviewRowDto {
  readonly id!: number;
  readonly displayName!: string;
  readonly mentionStatus!: MentionStatus;
  readonly lastMentionAt!: string | null;
  readonly mentionCount!: number;
  readonly capped!: boolean;
  readonly sentiment!: SentimentCounts;
  readonly latestHeadline!: HeadlineDto | null;

  constructor(fields: CompanyOverviewRowDto) {
    Object.assign(this, fields);
  }
}
