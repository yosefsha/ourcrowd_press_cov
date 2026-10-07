import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { ApiModule } from '../src/api.module';
import { configuration } from '../src/config/configuration';
import { configureApiApp } from '../src/configure-api-app';
import { buildTypeOrmOptions } from '../src/database/typeorm-options';
import type { RunRequest } from '../src/domain/run';
import { PostgresRunQueue } from '../src/runs/repositories/postgres-run.queue';
import { RunAlreadyActive } from '../src/runs/run-queue';

const backfill: RunRequest = {
  type: 'backfill',
  trigger: 'dashboard',
  params: { until: null, companyIds: null, reprocess: false },
};

/**
 * The runs API and the Postgres Run queue against the migrated database. Rows
 * created here are removed after each test; runs that existed before are kept.
 */
describe('Runs (ApiModule and PostgresRunQueue against Postgres)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  /** A second connection pool, standing in for a second collector process. */
  let otherDataSource: DataSource;
  let queue: PostgresRunQueue;
  let otherQueue: PostgresRunQueue;
  let runsBefore: number;
  const companyIds: number[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiModule] }).compile();
    app = configureApiApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
    await app.init();
    dataSource = app.get(DataSource);
    otherDataSource = await new DataSource(buildTypeOrmOptions(configuration().database.url)).initialize();
    queue = new PostgresRunQueue(dataSource);
    otherQueue = new PostgresRunQueue(otherDataSource);

    const [active] = await dataSource.query<{ id: number }[]>(
      `SELECT id FROM runs WHERE status IN ('queued', 'running')`,
    );
    if (active !== undefined) throw new Error(`Run ${active.id} is active in the test database; the e2e suite needs an idle queue`);
    const [{ max }] = await dataSource.query<{ max: number }[]>(`SELECT coalesce(max(id), 0)::int AS max FROM runs`);
    runsBefore = max;
  });

  afterEach(async () => {
    // run_company_errors cascade with their Run.
    await dataSource.query(`DELETE FROM runs WHERE id > $1`, [runsBefore]);
    await dataSource.query(`DELETE FROM collector_heartbeat`);
  });

  afterAll(async () => {
    if (companyIds.length > 0) await dataSource.query(`DELETE FROM tracked_companies WHERE id = ANY($1)`, [companyIds]);
    await otherDataSource.destroy();
    await app.close();
  });

  function server(): App {
    return app.getHttpServer();
  }

  async function insertCompany(displayName: string): Promise<number> {
    const [row] = await dataSource.query<{ id: number }[]>(
      `INSERT INTO tracked_companies (display_name, status) VALUES ($1, 'active') RETURNING id`,
      [`${displayName} ${Date.now()}`],
    );
    companyIds.push(row.id);
    return row.id;
  }

  describe('POST /api/runs', () => {
    it('answers 202 with the queued Run', async () => {
      const response = await request(server())
        .post('/api/runs')
        .send({ type: 'backfill', until: '2026-06-30', companyIds: [1, 2] })
        .expect(202);

      expect(response.body).toEqual({
        id: (expect.any(Number) as unknown),
        type: 'backfill',
        status: 'queued',
        trigger: 'dashboard',
        params: { until: '2026-06-30', companyIds: [1, 2], reprocess: false },
        progress: null,
        error: null,
        createdAt: (expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown),
        startedAt: null,
        finishedAt: null,
      });
    });

    it('of two concurrent enqueues accepts one and answers 409 with the active Run to the other', async () => {
      const responses = await Promise.all([
        request(server()).post('/api/runs').send({ type: 'backfill' }),
        request(server()).post('/api/runs').send({ type: 'daily_check' }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([202, 409]);
      const accepted = responses.find((response) => response.status === 202);
      const conflict = responses.find((response) => response.status === 409);
      expect(conflict?.body).toMatchObject({
        message: (expect.stringContaining('already queued') as unknown),
        activeRun: { id: (accepted?.body as { id: number } | undefined)?.id, status: 'queued' },
      });
    });

    it.each([
      [{ type: 'reprocess' }],
      [{ type: 'daily_check', until: '2026-06-30' }],
      [{ type: 'backfill', companyIds: [] }],
      [{ type: 'backfill', reprocess: true }],
    ])('answers 400 to %j', async (body) => {
      await request(server()).post('/api/runs').send(body).expect(400);
    });
  });

  describe('GET /api/runs/active', () => {
    it('answers 204 when the queue is idle', async () => {
      const response = await request(server()).get('/api/runs/active').expect(204);

      expect(response.text).toBe('');
    });

    it('answers the queued Run', async () => {
      const run = await queue.enqueue(backfill);

      const response = await request(server()).get('/api/runs/active').expect(200);

      expect(response.body).toMatchObject({ id: run.id, status: 'queued' });
    });
  });

  describe('GET /api/runs', () => {
    it('lists Runs newest first, limited', async () => {
      const first = await queue.enqueue(backfill);
      await queue.claimNext();
      await queue.finish(first.id, { status: 'completed' });
      const second = await queue.enqueue(backfill);

      const all = await request(server()).get('/api/runs').expect(200);
      const one = await request(server()).get('/api/runs?limit=1').expect(200);

      expect((all.body as { id: number }[]).slice(0, 2).map((run) => run.id)).toEqual([second.id, first.id]);
      expect(one.body).toHaveLength(1);
    });

    it.each(['0', '101', 'ten'])('answers 400 to limit=%s', async (limit) => {
      await request(server()).get(`/api/runs?limit=${limit}`).expect(400);
    });
  });

  describe('GET /api/runs/:id', () => {
    it('returns the Run with its named per-company errors', async () => {
      const harvey = await insertCompany('Harvey');
      const run = await queue.enqueue(backfill);
      await queue.claimNext();
      await queue.finish(run.id, {
        status: 'completed_with_errors',
        companyErrors: [{ companyId: harvey, stage: 'collection', message: 'Google News answered 503' }],
      });

      const response = await request(server()).get(`/api/runs/${run.id}`).expect(200);

      expect(response.body).toMatchObject({
        id: run.id,
        status: 'completed_with_errors',
        finishedAt: (expect.any(String) as unknown),
        companyErrors: [
          {
            companyId: harvey,
            companyName: (expect.stringMatching(/^Harvey /) as unknown),
            stage: 'collection',
            message: 'Google News answered 503',
          },
        ],
      });
    });

    it('answers 404 for an unknown Run and 400 for a non-numeric id', async () => {
      await request(server()).get('/api/runs/2147483000').expect(404);
      await request(server()).get('/api/runs/abc').expect(400);
    });
  });

  describe('PostgresRunQueue', () => {
    it('lets exactly one of two racing collectors claim the queued Run', async () => {
      const run = await queue.enqueue(backfill);

      const claims = await Promise.all([queue.claimNext(), otherQueue.claimNext()]);

      const claimed = claims.filter((claim) => claim !== null);
      expect(claimed).toHaveLength(1);
      expect(claimed[0]).toMatchObject({ id: run.id, status: 'running', startedAt: (expect.any(Date) as unknown) });
    });

    it('throws RunAlreadyActive carrying the running Run', async () => {
      const run = await queue.enqueue(backfill);
      await queue.claimNext();

      const error: unknown = await queue.enqueue(backfill).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(RunAlreadyActive);
      expect((error as RunAlreadyActive).activeRun).toMatchObject({ id: run.id, status: 'running' });
    });

    it('records progress, a failure, and interrupts a leftover running Run', async () => {
      const failed = await queue.enqueue(backfill);
      await queue.claimNext();
      await queue.reportProgress(failed.id, {
        companiesTotal: 3,
        companiesDone: 1,
        candidatesFound: 4,
        candidatesClassified: 2,
        mentionsConfirmed: 1,
        companyErrors: 0,
        currentCompany: 'Harvey',
      });
      await queue.finish(failed.id, { status: 'failed', error: 'Ollama is unreachable', companyErrors: [] });
      const leftover = await queue.enqueue(backfill);
      await queue.claimNext();

      await expect(queue.interruptRunning('restarted')).resolves.toEqual([leftover.id]);

      const rows = await dataSource.query<{ id: number; status: string; error: string; progress: unknown }[]>(
        `SELECT id, status, error, progress FROM runs WHERE id = ANY($1) ORDER BY id`,
        [[failed.id, leftover.id]],
      );
      expect(rows).toEqual([
        { id: failed.id, status: 'failed', error: 'Ollama is unreachable', progress: (expect.objectContaining({ currentCompany: 'Harvey' }) as unknown) },
        { id: leftover.id, status: 'interrupted', error: 'restarted', progress: null },
      ]);
      await expect(queue.finish(leftover.id, { status: 'completed' })).rejects.toMatchObject({ name: 'RunNotFound' });
    });
  });

  describe('GET /api/collector/health', () => {
    it('reports offline with nulls before the collector has ever reported', async () => {
      const response = await request(server()).get('/api/collector/health').expect(200);

      expect(response.body).toEqual({
        online: false,
        lastSeenAt: null,
        state: null,
        ollamaOk: null,
        ollamaModel: null,
        detail: null,
      });
    });

    it('reports online for a fresh heartbeat and offline for a stale one', async () => {
      await dataSource.query(
        `INSERT INTO collector_heartbeat (id, last_seen_at, state, ollama_ok, ollama_model) VALUES (1, now(), 'running', true, 'qwen2.5:7b')`,
      );
      const fresh = await request(server()).get('/api/collector/health').expect(200);
      await dataSource.query(`UPDATE collector_heartbeat SET last_seen_at = now() - interval '1 hour'`);
      const stale = await request(server()).get('/api/collector/health').expect(200);

      expect(fresh.body).toMatchObject({ online: true, state: 'running', ollamaOk: true, ollamaModel: 'qwen2.5:7b' });
      expect(stale.body).toMatchObject({ online: false, state: 'running' });
    });
  });
});
