import { Inject, Injectable } from '@nestjs/common';

import type { Run, RunOutcome } from '../domain/run';
import type { RunExecutor, RunProgressReporter } from '../runs/run-executor';
import { CLOCK, type Clock } from './clock';
import { backfillWindow, InvalidRunParams } from './collection-window';
import { CompanyCollectionService } from './company-collection.service';
import { PIPELINE_SETTINGS, type PipelineSettings } from './pipeline-settings';

/**
 * The Backfill: collects and classifies the whole Coverage Window, optionally
 * stopping at the `until` cutoff. With `reprocess`, the companies' Candidates
 * are discarded first and refetched. A Backfill never raises an Alert Digest.
 */
@Injectable()
export class BackfillExecutor implements RunExecutor {
  readonly runType = 'backfill' as const;

  constructor(
    private readonly collection: CompanyCollectionService,
    @Inject(PIPELINE_SETTINGS) private readonly settings: PipelineSettings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Throws `InvalidRunParams` for a Run of another type, a bad `until` or a Re-process of every company. */
  async execute(run: Run, progress: RunProgressReporter): Promise<RunOutcome> {
    if (run.type !== this.runType) throw new InvalidRunParams(`Run ${run.id} is a ${run.type}, not a backfill`);
    const { until, companyIds, reprocess } = run.params;
    if (reprocess && companyIds === null) {
      throw new InvalidRunParams('Re-process must name the companies it discards; it never applies to all of them');
    }
    const window = backfillWindow(until, this.clock.now(), this.settings.timeZone);
    const companies = await this.collection.companiesToCollect(companyIds);
    if (reprocess) await this.collection.discardCollected(companies);
    return this.collection.collect(
      { runId: run.id, window, companies, coverageCapped: 'record_always' },
      progress,
    );
  }
}
