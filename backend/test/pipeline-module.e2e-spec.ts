import type { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { RELEVANCE_CLASSIFIER } from '../src/classification/relevance-classifier';
import { DATA_EXPORTER, type DataExporter } from '../src/data-export/data-exporter';
import { SENTIMENT_CLASSIFIER } from '../src/classification/sentiment-classifier';
import type { RunStatus } from '../src/domain/run';
import { NEWS_SOURCE } from '../src/news/news-source';
import { BackfillExecutor } from '../src/pipeline/backfill.executor';
import { DailyCheckExecutor } from '../src/pipeline/daily-check.executor';
import { RUN_EXECUTORS, type RunExecutor } from '../src/runs/run-executor';
import { RUN_QUEUE, type RunQueue } from '../src/runs/run-queue';
import { RecordedClassifiers } from './pipeline/support/recorded-classifiers';
import { RecordedNewsSource } from './pipeline/support/recorded-news';
import { createCollectorContext } from './support/collector-context';

async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting for the Run to finish');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * The executors as the collector wires them: `PipelineModule` binds
 * `RUN_EXECUTORS`, and the Run worker executes a queued Backfill through it
 * against Postgres. The News Source and the classifiers are the recorded
 * in-memory ones, so nothing reaches Google News or Ollama, and the export
 * after the Run is a no-op.
 */
describe('PipelineModule in the CollectorModule (against Postgres)', () => {
  let context: INestApplicationContext;
  let dataSource: DataSource;
  let companyIds: number[] = [];
  let runsBefore = 0;

  beforeAll(async () => {
    const classifiers = new RecordedClassifiers();
    // The worker exports after every Run; keep it from writing the repository's data/ folder.
    const exporter: DataExporter = { exportAll: () => Promise.resolve() };
    context = await createCollectorContext((builder) =>
      builder
        .overrideProvider(DATA_EXPORTER)
        .useValue(exporter)
        .overrideProvider(NEWS_SOURCE)
        .useValue(new RecordedNewsSource())
        .overrideProvider(RELEVANCE_CLASSIFIER)
        .useValue(classifiers.relevance)
        .overrideProvider(SENTIMENT_CLASSIFIER)
        .useValue(classifiers.sentiment),
    );
    dataSource = context.get(DataSource);
    const [{ max }] = await dataSource.query<{ max: number }[]>(`SELECT coalesce(max(id), 0)::int AS max FROM runs`);
    runsBefore = max;
  });

  afterAll(async () => {
    await context.close();
    const cleanup = await new DataSource({ ...dataSource.options }).initialize();
    const articles = await cleanup.query<{ article_id: number }[]>(
      `DELETE FROM candidates WHERE company_id = ANY($1) RETURNING article_id`,
      [companyIds],
    );
    await cleanup.query(
      `DELETE FROM articles a WHERE a.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.article_id = a.id)`,
      [articles.map((row) => row.article_id)],
    );
    await cleanup.query(`DELETE FROM runs WHERE id > $1`, [runsBefore]);
    await cleanup.query(`DELETE FROM tracked_companies WHERE id = ANY($1)`, [companyIds]);
    await cleanup.query(`DELETE FROM collector_heartbeat`);
    await cleanup.destroy();
  });

  it('binds RUN_EXECUTORS to the Backfill and the Daily Check', () => {
    const executors = context.get<readonly RunExecutor[]>(RUN_EXECUTORS, { strict: false });

    expect(executors.map((executor) => executor.runType)).toEqual(['backfill', 'daily_check']);
    expect(executors[0]).toBeInstanceOf(BackfillExecutor);
    expect(executors[1]).toBeInstanceOf(DailyCheckExecutor);
  });

  it('executes a queued Backfill through the worker, storing Candidates and Mentions', async () => {
    const rows = await dataSource.query<{ id: number }[]>(
      `INSERT INTO tracked_companies (display_name, aliases, status)
       VALUES ('Cerebras', '{}', 'active'), ('Groq', '{}', 'active'), ('Innoviz', '{אינוויז}', 'active')
       RETURNING id`,
    );
    companyIds = rows.map((row) => row.id);
    const queue = context.get<RunQueue>(RUN_QUEUE, { strict: false });

    const run = await queue.enqueue({
      type: 'backfill',
      trigger: 'dashboard',
      params: { until: null, companyIds, reprocess: false },
    });
    const status = await waitFor(async () => {
      const [row] = await dataSource.query<{ status: RunStatus; error: string | null }[]>(
        `SELECT status, error FROM runs WHERE id = $1`,
        [run.id],
      );
      return row !== undefined && row.status !== 'queued' && row.status !== 'running' ? row : undefined;
    });

    expect(status).toEqual({ status: 'completed', error: null });
    const [counts] = await dataSource.query<{ candidates: number; mentions: number; confirmed: number }[]>(
      `SELECT count(*)::int AS candidates,
              count(*) FILTER (WHERE relevance = 'relevant')::int AS mentions,
              count(*) FILTER (WHERE confirmed_in_run_id = $2)::int AS confirmed
         FROM candidates WHERE company_id = ANY($1)`,
      [companyIds, run.id],
    );
    expect(counts).toEqual({ candidates: 24, mentions: 13, confirmed: 13 });
  });
});
