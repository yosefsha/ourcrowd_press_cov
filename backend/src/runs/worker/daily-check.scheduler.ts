import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import type { AppConfig, ScheduleConfig } from '../../config/configuration';
import type { Run } from '../../domain/run';
import { RUN_QUEUE, RunAlreadyActive, type RunQueue } from '../run-queue';

export const DAILY_CHECK_JOB = 'daily-check';

/**
 * Enqueues a Daily Check at `DAILY_CHECK_CRON` in `TZ` when
 * `DAILY_CHECK_SCHEDULE_ENABLED` is set. A Run already queued or running wins:
 * that day's scheduled check is skipped, not queued behind it.
 */
@Injectable()
export class DailyCheckScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(DailyCheckScheduler.name);
  private readonly schedule: ScheduleConfig;

  constructor(
    @Inject(RUN_QUEUE) private readonly queue: RunQueue,
    private readonly registry: SchedulerRegistry,
    config: ConfigService<AppConfig, true>,
  ) {
    this.schedule = config.get('schedule', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.schedule.dailyCheckEnabled) {
      this.logger.log('Daily Check schedule is disabled (DAILY_CHECK_SCHEDULE_ENABLED=false)');
      return;
    }
    const job = CronJob.from({
      cronTime: this.schedule.dailyCheckCron,
      timeZone: this.schedule.timeZone,
      onTick: () => void this.enqueueDailyCheck(),
      start: true,
    });
    this.registry.addCronJob(DAILY_CHECK_JOB, job);
    this.logger.log(`Daily Check scheduled at "${this.schedule.dailyCheckCron}" (${this.schedule.timeZone})`);
  }

  /** Enqueues the scheduled Daily Check; null when skipped. */
  async enqueueDailyCheck(): Promise<Run | null> {
    try {
      const run = await this.queue.enqueue({
        type: 'daily_check',
        trigger: 'schedule',
        params: { until: null, companyIds: null, reprocess: false },
      });
      this.logger.log(`Scheduled Daily Check queued as Run ${run.id}`);
      return run;
    } catch (error) {
      if (error instanceof RunAlreadyActive) {
        this.logger.log(`Scheduled Daily Check skipped: Run ${error.activeRun.id} is ${error.activeRun.status}`);
      } else {
        this.logger.error(
          `Scheduled Daily Check could not be queued: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }
}
