import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/** `:id` of an Alert Digest route. */
export class AlertDigestIdParams {
  @Type(() => Number)
  @IsInt({ message: 'id must be an integer' })
  @Min(1)
  readonly id!: number;
}
