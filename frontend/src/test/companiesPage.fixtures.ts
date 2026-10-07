/**
 * PROVISIONAL test fixtures for the Companies page (#15).
 *
 * The admin API (#7) does not exist yet, so these cannot be recorded from it as
 * ADR-006 requires. They are kept minimal, typed against `types.ts`, and use
 * real Seed List lines from docs/ourcrowd_companies.txt. Replace them with
 * responses recorded from the real `/api/admin/companies` endpoints once #7
 * lands. Imported by tests only — never by application code.
 */
import { ApiError, RunConflictError } from '../apiErrors.ts';
import type { AdminCompany, Run } from '../types.ts';

/** Seed line "Harvey": a first name, so triage flagged it for review. */
export const harveyNeedsReview: AdminCompany = {
  id: 6,
  sourceName: 'Harvey',
  displayName: 'Harvey',
  aliases: [],
  domain: null,
  description: null,
  searchTerms: ['Harvey'],
  status: 'needs_review',
  reviewReason: 'The name is a common first name; a news search would mostly return unrelated people.',
  coverageCapped: false,
  createdAt: '2026-10-01T06:00:00.000Z',
  updatedAt: '2026-10-01T06:00:00.000Z',
};

/** Seed line "Lambda (lambda.ai)": display name and domain parsed from the line. */
export const lambdaActive: AdminCompany = {
  id: 16,
  sourceName: 'Lambda (lambda.ai)',
  displayName: 'Lambda',
  aliases: [],
  domain: 'lambda.ai',
  description: null,
  searchTerms: ['"Lambda" GPU cloud'],
  status: 'active',
  reviewReason: null,
  coverageCapped: false,
  createdAt: '2026-10-01T06:00:00.000Z',
  updatedAt: '2026-10-01T06:00:00.000Z',
};

/** Seed line "Ludeo (formerly Edge)": the former name parsed into an alias. */
export const ludeoDeactivated: AdminCompany = {
  id: 51,
  sourceName: 'Ludeo (formerly Edge)',
  displayName: 'Ludeo',
  aliases: ['Edge'],
  domain: null,
  description: null,
  searchTerms: ['Ludeo'],
  status: 'deactivated',
  reviewReason: null,
  coverageCapped: false,
  createdAt: '2026-10-01T06:00:00.000Z',
  updatedAt: '2026-10-03T09:30:00.000Z',
};

export const adminCompanies: readonly AdminCompany[] = [harveyNeedsReview, lambdaActive, ludeoDeactivated];

/** A company as POST /api/admin/companies would return it: added by hand, so no Source Name. */
export function addedByHand(displayName: string, id: number): AdminCompany {
  return {
    id,
    sourceName: null,
    displayName,
    aliases: [],
    domain: null,
    description: null,
    searchTerms: [],
    status: 'active',
    reviewReason: null,
    coverageCapped: false,
    createdAt: '2026-10-07T08:00:00.000Z',
    updatedAt: '2026-10-07T08:00:00.000Z',
  };
}

/** The Run a Daily Check would hold while a Re-process is attempted. */
export const runningDailyCheck: Run = {
  id: 31,
  type: 'daily_check',
  status: 'running',
  trigger: 'schedule',
  params: { until: null, companyIds: null, reprocess: false },
  progress: null,
  error: null,
  createdAt: '2026-10-07T07:00:00.000Z',
  startedAt: '2026-10-07T07:00:02.000Z',
  finishedAt: null,
};

/** The Backfill a successful Re-process of Lambda queues. */
export const lambdaReprocessRun: Run = {
  id: 32,
  type: 'backfill',
  status: 'queued',
  trigger: 'dashboard',
  params: { until: null, companyIds: [lambdaActive.id], reprocess: true },
  progress: null,
  error: null,
  createdAt: '2026-10-07T08:05:00.000Z',
  startedAt: null,
  finishedAt: null,
};

/** The 409 the reprocess endpoint answers while another Run is active, as the client decodes it. */
export function runConflict(): RunConflictError {
  const body = { message: 'Another Run is already queued or running', activeRun: runningDailyCheck };
  return new RunConflictError(body.message, body, runningDailyCheck);
}

/** A NestJS ValidationPipe 400, as the client decodes it. */
export function validationError(messages: readonly string[]): ApiError {
  return new ApiError(400, messages.join('; '), { statusCode: 400, error: 'Bad Request', message: messages });
}
