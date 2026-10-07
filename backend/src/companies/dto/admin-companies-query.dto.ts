import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { TRACKED_COMPANY_STATUSES, type TrackedCompanyStatus } from '../../domain/company';
import { MAX_NAME_LENGTH } from './company-profile-fields';

/** GET /api/admin/companies?status=&q= */
export class AdminCompaniesQueryDto {
  @IsOptional()
  @IsIn(TRACKED_COMPANY_STATUSES)
  readonly status?: TrackedCompanyStatus;

  /** Case-insensitive match on display name, aliases or Source Name; blank matches everything. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  readonly q?: string;
}
