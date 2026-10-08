import { IsOptional, IsString, MaxLength } from 'class-validator';

import { ROLLING_WINDOW_KEY } from '../../domain/coverage-window';

/** `?window=` — `rolling90` (the default) or a quarter such as `2026-Q3`. Parsed by the service. */
export class CoverageWindowQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  readonly window: string = ROLLING_WINDOW_KEY;
}
