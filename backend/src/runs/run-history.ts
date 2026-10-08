import type { Run, RunStage } from '../domain/run';

/** Injection token for the `RunHistory` port. */
export const RUN_HISTORY = Symbol('RUN_HISTORY');

/** One company's failure inside a Run, with the company's display name. */
export interface RunCompanyErrorDetail {
  readonly companyId: number;
  readonly companyName: string;
  readonly stage: RunStage;
  readonly message: string;
}

/** A Run together with the per-company errors it recorded. */
export interface RunDetail {
  readonly run: Run;
  readonly companyErrors: readonly RunCompanyErrorDetail[];
}

/** Read side of the Runs table, for the dashboard (ADR-009). */
export interface RunHistory {
  /** The most recent Runs, newest first. */
  listRecent(limit: number): Promise<readonly Run[]>;
  /** The queued or running Run; null when the queue is idle. */
  findActive(): Promise<Run | null>;
  /** One Run with its per-company errors. Throws `RunNotFound`. */
  getDetail(runId: number): Promise<RunDetail>;
}
