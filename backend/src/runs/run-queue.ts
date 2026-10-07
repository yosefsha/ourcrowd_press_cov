import type { Run, RunOutcome, RunProgress, RunRequest } from '../domain/run';

/** Injection token for the `RunQueue` port. */
export const RUN_QUEUE = Symbol('RUN_QUEUE');

/**
 * The queue of Runs shared by the API (which enqueues) and the collector (which
 * claims and executes) — ADR-009. At most one Run is queued or running at a time.
 */
export interface RunQueue {
  /** Queues a Run. Throws `RunAlreadyActive` while another Run is queued or running. */
  enqueue(request: RunRequest): Promise<Run>;
  /** Marks the oldest queued Run as running and returns it; null when none is queued. */
  claimNext(): Promise<Run | null>;
  /** Replaces a running Run's progress. Throws `RunNotFound`. */
  reportProgress(runId: number, progress: RunProgress): Promise<void>;
  /** Records how a running Run ended and its per-company errors. Throws `RunNotFound`. */
  finish(runId: number, outcome: RunOutcome): Promise<void>;
}

/** Another Run is already queued or running; carries it so the caller can show it. */
export class RunAlreadyActive extends Error {
  constructor(readonly activeRun: Run) {
    super(`Run ${activeRun.id} is already ${activeRun.status}`);
    this.name = 'RunAlreadyActive';
  }
}

export class RunNotFound extends Error {
  constructor(readonly runId: number) {
    super(`Run ${runId} does not exist`);
    this.name = 'RunNotFound';
  }
}
