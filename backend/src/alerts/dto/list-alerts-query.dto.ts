import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

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
}
