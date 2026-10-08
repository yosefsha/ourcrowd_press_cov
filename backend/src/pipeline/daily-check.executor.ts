import { Inject, Injectable } from '@nestjs/common';

import { ALERT_DIGEST_BUILDER, type AlertDigestBuilder } from '../alerts/alert-digest-builder';
import type { Run, RunOutcome } from '../domain/run';
import { type RunExecutor, RunInterrupted, type RunProgressReporter } from '../runs/run-executor';
import { CLOCK, type Clock } from './clock';
import { dailyCheckWindow, InvalidRunParams } from './collection-window';
import { CompanyCollectionService } from './company-collection.service';
import { PIPELINE_SETTINGS, type PipelineSettings } from './pipeline-settings';
import { RUN_HISTORY, type RunHistory } from './run-history';

/**
 * The Daily Check: collects what was published since the start of the last
 * successful Daily Check (minus a day of overlap), classifies it, and ends by
 * building the Alert Digest of the Mentions it confirmed (ADR-004).
 */
@Injectable()
export class DailyCheckExecutor implements RunExecutor {
  readonly runType = 'daily_check' as const;

  constructor(
    private readonly collection: CompanyCollectionService,
    @Inject(RUN_HISTORY) private readonly history: RunHistory,
    @Inject(ALERT_DIGEST_BUILDER) private readonly digests: AlertDigestBuilder,
    @Inject(PIPELINE_SETTINGS) private readonly settings: PipelineSettings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Throws `InvalidRunParams` for a Run of another type, or one asking for
   * `until` or Re-process, and `RunInterrupted` when `signal` aborts — after
   * building the digest of what it did confirm, which no later Run would alert on.
   */
  async execute(run: Run, progress: RunProgressReporter, signal: AbortSignal): Promise<RunOutcome> {
    if (run.type !== this.runType) throw new InvalidRunParams(`Run ${run.id} is a ${run.type}, not a daily_check`);
    if (run.params.until !== null || run.params.reprocess) {
      throw new InvalidRunParams('A Daily Check takes no until cutoff and never re-processes');
    }
    const lastStart = await this.history.lastSuccessfulStart(this.runType, run.id);
    const window = dailyCheckWindow(lastStart, this.clock.now(), this.settings.timeZone);
    const companies = await this.collection.companiesToCollect(run.params.companyIds);
    let outcome: RunOutcome;
    try {
      outcome = await this.collection.collect(
        { runId: run.id, window, companies, coverageCapped: 'record_when_capped' },
        progress,
        signal,
      );
    } catch (error) {
      if (error instanceof RunInterrupted) await this.digests.buildForRun(run.id);
      throw error;
    }
    // Also after a failed Run: Mentions it did confirm are New Mentions of this
    // Run and would otherwise never be alerted on.
    return this.raiseDigest(run.id, outcome);
  }

  private async raiseDigest(runId: number, outcome: RunOutcome): Promise<RunOutcome> {
    try {
      await this.digests.buildForRun(runId);
      return outcome;
    } catch (error) {
      const message = `The Alert Digest could not be built: ${error instanceof Error ? error.message : String(error)}`;
      return {
        status: 'failed',
        error: outcome.status === 'failed' ? `${outcome.error}; ${message}` : message,
        companyErrors: outcome.status === 'completed' ? [] : outcome.companyErrors,
      };
    }
  }
}
