import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { CANDIDATE_SELECTIONS, type CandidateSelection } from '../coverage-read-model';
import { CoverageWindowQueryDto } from './coverage-window-query.dto';

export const MAX_CANDIDATES_PAGE_SIZE = 100;

/** `GET /api/companies/:id/candidates` query. Pages are 1-based. */
export class CandidatesQueryDto extends CoverageWindowQueryDto {
  @IsOptional()
  @IsIn(CANDIDATE_SELECTIONS)
  readonly include: CandidateSelection = 'mentions';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  readonly page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CANDIDATES_PAGE_SIZE)
  readonly pageSize: number = 20;
}
