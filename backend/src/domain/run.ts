/** A Run is one execution of a Backfill or a Daily Check. */
export const RUN_TYPES = ['backfill', 'daily_check'] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'interrupted',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** The statuses that make a Run the active one; at most one Run holds them at a time. */
export const ACTIVE_RUN_STATUSES = ['queued', 'running'] as const satisfies readonly RunStatus[];

export const RUN_TRIGGERS = ['dashboard', 'schedule'] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];

/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

export interface RunParams {
  /** Backfill cutoff date; null means up to today. */
  readonly until: IsoDate | null;
  /** Restricts the Run to these Tracked Companies; null means every active one. */
  readonly companyIds: readonly number[] | null;
  /** Discard the companies' Candidates and Mentions first (Re-process). */
  readonly reprocess: boolean;
}

/** What is asked of the Run queue: a Run of a type, with its parameters and who asked. */
export interface RunRequest {
  readonly type: RunType;
  readonly trigger: RunTrigger;
  readonly params: RunParams;
}

/** Live progress the collector writes to the Run while it executes. */
export interface RunProgress {
  readonly companiesTotal: number;
  readonly companiesDone: number;
  readonly candidatesFound: number;
  readonly candidatesClassified: number;
  readonly mentionsConfirmed: number;
  readonly companyErrors: number;
  /** Display name of the Tracked Company being processed, if any. */
  readonly currentCompany: string | null;
}

export interface Run extends RunRequest {
  readonly id: number;
  readonly status: RunStatus;
  /** Null until the collector claims the Run. */
  readonly progress: RunProgress | null;
  readonly error: string | null;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
}

/** The pipeline stage at which one company failed inside a Run. */
export const RUN_STAGES = ['collection', 'relevance', 'sentiment'] as const;
export type RunStage = (typeof RUN_STAGES)[number];

/** One company's failure inside a Run that otherwise carried on. */
export interface RunCompanyError {
  readonly companyId: number;
  readonly stage: RunStage;
  readonly message: string;
}

/**
 * How an executed Run ended. `interrupted` is not an outcome: it is recorded by
 * the collector for a Run it finds `running` after a restart.
 */
export type RunOutcome =
  | { readonly status: 'completed' }
  | {
      readonly status: 'completed_with_errors';
      readonly companyErrors: readonly [RunCompanyError, ...RunCompanyError[]];
    }
  | {
      readonly status: 'failed';
      readonly error: string;
      readonly companyErrors: readonly RunCompanyError[];
    };
