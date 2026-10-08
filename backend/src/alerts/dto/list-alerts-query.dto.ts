import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Digests listed when no `limit` is given; one Daily Check a day makes this months of history. */
export const DEFAULT_ALERTS_LIMIT = 50;
export const MAX_ALERTS_LIMIT = 200;

/** Query string values arrive as text; only the literal words are booleans. */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/** `GET /api/alerts?acknowledged=` */
export class ListAlertsQueryDto {
  /** true: acknowledged only; false: unacknowledged only; omitted: all. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'acknowledged must be true or false' })
  readonly acknowledged?: boolean;

  /** At most this many digests, newest first. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1)
  @Max(MAX_ALERTS_LIMIT)
  readonly limit: number = DEFAULT_ALERTS_LIMIT;
}
