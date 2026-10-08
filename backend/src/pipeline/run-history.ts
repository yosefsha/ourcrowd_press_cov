import type { RunType } from '../domain/run';

/** Injection token for the `RunHistory` port. */
export const RUN_HISTORY = Symbol('RUN_HISTORY');

/** Past Runs, as far as an executing Run needs to know about them. */
export interface RunHistory {
  /**
   * When the most recent Run of `type` that covered every active company
   * (no `companyIds`) and completed without errors started, other than
   * `excludingRunId`; null when there is none. A Run limited to some companies
   * says nothing about the others, so it never counts. Throws `RunHistoryUnavailable`.
   */
  lastSuccessfulStart(type: RunType, excludingRunId: number): Promise<Date | null>;
}

export class RunHistoryUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RunHistoryUnavailable';
  }
}
