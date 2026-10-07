import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

import { RUN_TYPES, type IsoDate, type RunType } from '../../domain/run';

/** Most companies one Run may be restricted to. */
export const MAX_RUN_COMPANY_IDS = 1000;

/** `POST /api/runs`: a Backfill or a Daily Check asked for from the dashboard. */
export class EnqueueRunDto {
  @IsIn(RUN_TYPES)
  readonly type!: RunType;

  /** Backfill cutoff date, `YYYY-MM-DD`; omitted means up to today. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'until must be a date in YYYY-MM-DD form' })
  @IsISO8601({ strict: true }, { message: 'until must be a valid calendar date' })
  readonly until?: IsoDate;

  /** Restricts the Run to these Tracked Companies; omitted means every active one. */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_RUN_COMPANY_IDS)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  readonly companyIds?: number[];
}
