import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_RUN_HISTORY_LIMIT = 20;
export const MAX_RUN_HISTORY_LIMIT = 100;

/** `GET /api/runs?limit=` */
export class ListRunsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RUN_HISTORY_LIMIT)
  readonly limit: number = DEFAULT_RUN_HISTORY_LIMIT;
}
