import type { Relevance, RelevanceMethod } from '../../domain/relevance';
import type { Sentiment } from '../../domain/sentiment';
import type { ArticleDto } from './article.dto';

/** A Candidate with its Relevance Verdict and, for Mentions, Sentiment. */
export class CandidateDto {
  readonly id!: number;
  readonly article!: ArticleDto;
  readonly relevance!: Relevance;
  readonly relevanceMethod!: RelevanceMethod | null;
  readonly relevanceReason!: string | null;
  readonly sentiment!: Sentiment | null;
  readonly sentimentReason!: string | null;
  readonly confirmedAt!: string | null;

  constructor(fields: CandidateDto) {
    Object.assign(this, fields);
  }
}
