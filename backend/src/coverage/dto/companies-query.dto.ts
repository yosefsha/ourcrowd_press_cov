import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { MENTION_STATUSES, type MentionStatus } from '../../domain/mention-status';
import { CoverageWindowQueryDto } from './coverage-window-query.dto';

/** Overview sort orders; `negatives` sorts by negative Mentions in the window, then recency. */
export const COMPANY_SORTS = ['negatives', 'recency', 'mentions', 'name'] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

/** Query strings carry booleans as text; anything but `true`/`false` is left for `@IsBoolean` to reject. */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/** `GET /api/companies` query. */
export class CompaniesQueryDto extends CoverageWindowQueryDto {
  @IsOptional()
  @IsIn(MENTION_STATUSES)
  readonly status?: MentionStatus;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  readonly hasNegatives?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  readonly q?: string;

  @IsOptional()
  @IsIn(COMPANY_SORTS)
  readonly sort: CompanySort = 'negatives';
}
