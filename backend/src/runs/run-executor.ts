import type { Run, RunOutcome, RunProgress, RunType } from '../domain/run';

/**
 * Injection token for the list of `RunExecutor`s — one per Run type. Adding a
 * Run type means adding an executor to this list, not editing the worker.
 */
export const RUN_EXECUTORS = Symbol('RUN_EXECUTORS');

/** Where an executing Run reports its live progress. */
export interface RunProgressReporter {
  report(progress: RunProgress): Promise<void>;
}

/** Executes one type of Run: the Backfill or the Daily Check. */
export interface RunExecutor {
  readonly runType: RunType;
  /**
   * Executes a claimed Run to the end. Per-company failures are returned in the
   * outcome, not thrown; a thrown error means the Run as a whole failed.
   *
   * `signal` aborts when the collector shuts down: the executor finishes the
   * company in hand, then throws `RunInterrupted` instead of starting the next.
   */
  execute(run: Run, progress: RunProgressReporter, signal: AbortSignal): Promise<RunOutcome>;
}

/** No executor is registered for the Run's type. */
export class NoExecutorForRunType extends Error {
  constructor(readonly runType: RunType) {
    super(`No executor is registered for Runs of type ${runType}`);
    this.name = 'NoExecutorForRunType';
  }
}

/** The executor stopped early because the collector is shutting down. */
export class RunInterrupted extends Error {
  constructor(readonly runId: number) {
    super(`Run ${runId} was interrupted by a collector shutdown`);
    this.name = 'RunInterrupted';
  }
}
