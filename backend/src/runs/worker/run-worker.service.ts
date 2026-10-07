import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { DATA_EXPORTER, type DataExporter } from '../../data-export/data-exporter';
import type { Run, RunOutcome, RunType } from '../../domain/run';
import { NoExecutorForRunType, RUN_EXECUTORS, RunInterrupted, type RunExecutor } from '../run-executor';
import { RUN_QUEUE, type RunQueue } from '../run-queue';
import { CollectorActivity } from './collector-activity';

export const INTERRUPTED_BY_RESTART = 'The collector restarted while this Run was running';
export const INTERRUPTED_BY_SHUTDOWN = 'The collector shut down while this Run was running';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function indexByRunType(executors: readonly RunExecutor[]): ReadonlyMap<RunType, RunExecutor> {
  const byType = new Map<RunType, RunExecutor>();
  for (const executor of executors) {
    if (byType.has(executor.runType)) {
      throw new Error(`More than one RunExecutor is registered for Runs of type ${executor.runType}`);
    }
    byType.set(executor.runType, executor);
  }
  return byType;
}

/**
 * The collector's Run loop (ADR-009): every `RUN_POLL_INTERVAL_MS` it claims
 * the next queued Run, hands it to the `RunExecutor` registered for its type,
 * records the outcome and refreshes the `data/` export. A Run found `running`
 * at startup was cut short by a crash and is marked `interrupted`; on shutdown
 * the executor is asked to stop after its current company and the Run is
 * marked `interrupted` too.
 */
@Injectable()
export class RunWorker implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(RunWorker.name);
  private readonly executors: ReadonlyMap<RunType, RunExecutor>;
  private readonly pollIntervalMs: number;
  private readonly shutdown = new AbortController();
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | null = null;

  constructor(
    @Inject(RUN_QUEUE) private readonly queue: RunQueue,
    private readonly activity: CollectorActivity,
    config: ConfigService<AppConfig, true>,
    // Optional until the pipeline and export modules bind them; an unbound
    // executor fails its Runs and an unbound exporter is skipped, both loudly.
    @Optional() @Inject(RUN_EXECUTORS) executors: readonly RunExecutor[] | null = null,
    @Optional() @Inject(DATA_EXPORTER) private readonly exporter: DataExporter | null = null,
  ) {
    this.executors = indexByRunType(executors ?? []);
    this.pollIntervalMs = config.get('runs.pollIntervalMs', { infer: true });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.executors.size === 0) this.logger.warn('No RunExecutor is registered: every Run will fail');
    if (this.exporter === null) this.logger.warn('No DataExporter is registered: the data/ export is not written');
    await this.recoverInterruptedRuns();
    this.scheduleNextPoll(0);
  }

  async beforeApplicationShutdown(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.shutdown.abort();
    await this.inFlight;
  }

  /** Marks Runs left `running` by a previous collector process as `interrupted`. */
  async recoverInterruptedRuns(): Promise<readonly number[]> {
    const interrupted = await this.queue.interruptRunning(INTERRUPTED_BY_RESTART);
    if (interrupted.length > 0) this.logger.warn(`Marked Runs ${interrupted.join(', ')} as interrupted`);
    return interrupted;
  }

  /** Claims and executes one queued Run. Returns the Run, or null when none was queued. */
  async pollOnce(): Promise<Run | null> {
    const run = await this.queue.claimNext();
    if (run === null) return null;
    this.activity.set('running');
    try {
      await this.execute(run);
    } finally {
      this.activity.set('idle');
      await this.exportData();
    }
    return run;
  }

  private scheduleNextPoll(delayMs: number): void {
    if (this.shutdown.signal.aborted) return;
    this.timer = setTimeout(() => {
      this.inFlight = this.pollOnce()
        .then(() => undefined)
        .catch((error: unknown) => this.logger.error(`Run poll failed: ${errorMessage(error)}`))
        .finally(() => {
          this.inFlight = null;
          this.scheduleNextPoll(this.pollIntervalMs);
        });
    }, delayMs);
  }

  private async execute(run: Run): Promise<void> {
    this.logger.log(`Run ${run.id} (${run.type}) started`);
    const executor = this.executors.get(run.type);
    let outcome: RunOutcome;
    if (executor === undefined) {
      outcome = { status: 'failed', error: new NoExecutorForRunType(run.type).message, companyErrors: [] };
    } else {
      try {
        outcome = await executor.execute(
          run,
          { report: (progress) => this.queue.reportProgress(run.id, progress) },
          this.shutdown.signal,
        );
      } catch (error) {
        if (error instanceof RunInterrupted || this.shutdown.signal.aborted) {
          await this.queue.interruptRunning(INTERRUPTED_BY_SHUTDOWN);
          this.logger.warn(`Run ${run.id} interrupted by shutdown`);
          return;
        }
        outcome = { status: 'failed', error: errorMessage(error), companyErrors: [] };
      }
    }
    await this.queue.finish(run.id, outcome);
    this.logger.log(`Run ${run.id} finished: ${outcome.status}`);
  }

  private async exportData(): Promise<void> {
    if (this.exporter === null) return;
    try {
      await this.exporter.exportAll();
    } catch (error) {
      this.logger.error(`Data export failed: ${errorMessage(error)}`);
    }
  }
}
