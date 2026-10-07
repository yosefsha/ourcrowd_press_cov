import type { RunStage } from '../../domain/run';
import type { RunCompanyErrorDetail, RunDetail } from '../run-history';
import { RunDto } from './run.dto';

export class RunCompanyErrorDto {
  readonly companyId!: number;
  readonly companyName!: string;
  readonly stage!: RunStage;
  readonly message!: string;

  static from(error: RunCompanyErrorDetail): RunCompanyErrorDto {
    return Object.assign(new RunCompanyErrorDto(), {
      companyId: error.companyId,
      companyName: error.companyName,
      stage: error.stage,
      message: error.message,
    });
  }
}

/** `GET /api/runs/:id`: a Run with the per-company errors it recorded. */
export class RunDetailDto extends RunDto {
  readonly companyErrors!: readonly RunCompanyErrorDto[];

  static fromDetail(detail: RunDetail): RunDetailDto {
    return Object.assign(new RunDetailDto(), RunDto.from(detail.run), {
      companyErrors: detail.companyErrors.map((error) => RunCompanyErrorDto.from(error)),
    });
  }
}
