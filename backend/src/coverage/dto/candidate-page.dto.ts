import type { CandidateDto } from './candidate.dto';

/** `GET /api/companies/:id/candidates` — one 1-based page. */
export class CandidatePageDto {
  readonly items!: readonly CandidateDto[];
  readonly total!: number;
  readonly page!: number;
  readonly pageSize!: number;

  constructor(fields: CandidatePageDto) {
    Object.assign(this, fields);
  }
}
