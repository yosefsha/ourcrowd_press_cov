import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

import type { AppConfig, ScheduleConfig } from '../../config/configuration';
import { InMemoryRunStore } from '../repositories/in-memory-run.store';
import { DAILY_CHECK_JOB, DailyCheckScheduler } from './daily-check.scheduler';

function scheduler(store: InMemoryRunStore, registry: SchedulerRegistry, schedule: Partial<ScheduleConfig> = {}): DailyCheckScheduler {
  const config = new ConfigService<AppConfig, true>({
    schedule: { dailyCheckEnabled: true, dailyCheckCron: '0 7 * * *', timeZone: 'Asia/Jerusalem', ...schedule },
  });
  return new DailyCheckScheduler(store, registry, config);
}

describe('DailyCheckScheduler', () => {
  let registry: SchedulerRegistry;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    registry = new SchedulerRegistry();
  });

  afterEach(() => {
    for (const job of registry.getCronJobs().values()) void job.stop();
  });

  it('registers no cron job when the schedule is disabled', () => {
    scheduler(new InMemoryRunStore(), registry, { dailyCheckEnabled: false }).onApplicationBootstrap();

    expect(registry.doesExist('cron', DAILY_CHECK_JOB)).toBe(false);
  });

  it('registers the cron at DAILY_CHECK_CRON in TZ when enabled', () => {
    scheduler(new InMemoryRunStore(), registry, { dailyCheckCron: '30 6 * * 1-5', timeZone: 'Europe/London' }).onApplicationBootstrap();

    const job = registry.getCronJob(DAILY_CHECK_JOB);
    expect(job.isActive).toBe(true);
    expect(job.cronTime.source).toBe('30 6 * * 1-5');
    expect(job.cronTime.timeZone).toBe('Europe/London');
  });

  it('queues a scheduled Daily Check over every active company', async () => {
    const store = new InMemoryRunStore();

    const run = await scheduler(store, registry).enqueueDailyCheck();

    expect(run).toMatchObject({
      type: 'daily_check',
      trigger: 'schedule',
      status: 'queued',
      params: { until: null, companyIds: null, reprocess: false },
    });
  });

  it('skips the Daily Check while another Run is active', async () => {
    const store = new InMemoryRunStore();
    const active = await store.enqueue({
      type: 'backfill',
      trigger: 'dashboard',
      params: { until: null, companyIds: null, reprocess: false },
    });

    await expect(scheduler(store, registry).enqueueDailyCheck()).resolves.toBeNull();

    expect(store.all()).toEqual([active]);
  });

  it('logs and skips when the queue cannot be reached', async () => {
    const store = new InMemoryRunStore();
    jest.spyOn(store, 'enqueue').mockRejectedValue(new Error('connection refused'));

    await expect(scheduler(store, registry).enqueueDailyCheck()).resolves.toBeNull();
  });
});
