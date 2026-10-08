import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import type { AppConfig } from '../src/config/configuration';
import type { DataExporter } from '../src/data-export/data-exporter';
import type { Run, RunOutcome } from '../src/domain/run';
import type { RunExecutor, RunProgressReporter } from '../src/runs/run-executor';
import { RUN_QUEUE, type RunQueue } from '../src/runs/run-queue';
import { CollectorActivity } from '../src/runs/worker/collector-activity';
import { RunWorker } from '../src/runs/worker/run-worker.service';
import { createCollectorContext } from './support/collector-context';

class CompletingBackfill implements RunExecutor {
  readonly runType = 'backfill';
  async execute(_run: Run, progress: RunProgressReporter): Promise<RunOutcome> {
    await progress.report({
      companiesTotal: 1,
      companiesDone: 1,
      candidatesFound: 0,
      candidatesClassified: 0,
      mentionsConfirmed: 0,
      companyErrors: 0,
      currentCompany: null,
    });
    return { status: 'completed' };
  }
}

async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting for the collector');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * The collector's Run loop end to end against Postgres: a queued Run is claimed,
 * executed and finished, the export runs, and the heartbeat is written.
 * Executors and the exporter are in-memory; the queue and heartbeat are real.
 */
describe('RunWorker in the CollectorModule (against Postgres)', () => {
  let context: INestApplicationContext;
  let dataSource: DataSource;
  let exports = 0;
  let runsBefore: number;

  beforeAll(async () => {
    const exporter: DataExporter = {
      exportAll: () => {
        exports += 1;
        return Promise.resolve();
      },
    };
    context = await createCollectorContext((builder) =>
      builder
        .overrideProvider(RunWorker)
        .useFactory({
          factory: (queue: RunQueue, activity: CollectorActivity, config: ConfigService<AppConfig, true>) =>
            new RunWorker(queue, exporter, activity, config, [new CompletingBackfill()]),
          inject: [RUN_QUEUE, CollectorActivity, ConfigService],
        }),
    );
    dataSource = context.get(DataSource);
    const [{ max }] = await dataSource.query<{ max: number }[]>(`SELECT coalesce(max(id), 0)::int AS max FROM runs`);
    runsBefore = max;
  });

  afterAll(async () => {
    await context.close();
    const cleanup = await new DataSource({ ...dataSource.options }).initialize();
    await cleanup.query(`DELETE FROM runs WHERE id > $1`, [runsBefore]);
    await cleanup.query(`DELETE FROM collector_heartbeat`);
    await cleanup.destroy();
  });

  it('claims a queued Run, executes it, records the outcome and exports', async () => {
    const run = await context.get<RunQueue>(RUN_QUEUE).enqueue({
      type: 'backfill',
      trigger: 'dashboard',
      params: { until: null, companyIds: null, reprocess: false },
    });

    const finished = await waitFor(async () => {
      const [row] = await dataSource.query<{ status: string; progress: unknown }[]>(
        `SELECT status, progress FROM runs WHERE id = $1 AND finished_at IS NOT NULL`,
        [run.id],
      );
      return row;
    });

    expect(finished).toMatchObject({ status: 'completed', progress: (expect.objectContaining({ companiesDone: 1 }) as unknown) });
    await waitFor(() => Promise.resolve(exports > 0 ? true : undefined));
  });

  it('writes the heartbeat with the classifier health', async () => {
    const heartbeat = await waitFor(async () => {
      const [row] = await dataSource.query<{ state: string; ollama_ok: boolean; ollama_model: string }[]>(
        `SELECT state, ollama_ok, ollama_model FROM collector_heartbeat WHERE last_seen_at > now() - interval '1 minute'`,
      );
      return row;
    });

    expect(heartbeat).toEqual({ state: (expect.any(String) as unknown), ollama_ok: true, ollama_model: 'qwen2.5:7b' });
  });
});
