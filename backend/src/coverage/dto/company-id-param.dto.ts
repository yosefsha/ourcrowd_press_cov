import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Largest value of a Postgres `integer` identity column. */
const MAX_ID = 2_147_483_647;

/** `:id` of a Tracked Company. */
export class CompanyIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ID)
  readonly id!: number;
}
