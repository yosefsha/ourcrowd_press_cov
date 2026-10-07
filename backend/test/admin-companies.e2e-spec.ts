import { Global, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { CompaniesModule } from '../src/companies/companies.module';
import { AppConfigModule } from '../src/config/app-config.module';
import { configureApiApp } from '../src/configure-api-app';
import { DatabaseModule } from '../src/database/database.module';
import type { Run, RunOutcome, RunProgress, RunRequest } from '../src/domain/run';
import { RUN_QUEUE, RunAlreadyActive, type RunQueue } from '../src/runs/run-queue';

/** Queues Runs in memory; answers `RunAlreadyActive` while one is queued. */
class InMemoryRunQueue implements RunQueue {
  readonly runs: Run[] = [];

  enqueue(request: RunRequest): Promise<Run> {
    const active = this.runs.find((run) => run.status === 'queued' || run.status === 'running');
    if (active !== undefined) return Promise.reject(new RunAlreadyActive(active));
    const run: Run = {
      ...request,
      id: this.runs.length + 1,
      status: 'queued',
      progress: null,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
    };
    this.runs.push(run);
    return Promise.resolve(run);
  }

  claimNext(): Promise<Run | null> {
    return Promise.resolve(null);
  }

  reportProgress(_runId: number, _progress: RunProgress): Promise<void> {
    return Promise.resolve();
  }

  finish(_runId: number, _outcome: RunOutcome): Promise<void> {
    return Promise.resolve();
  }
}

const runQueue = new InMemoryRunQueue();

/** Supplies RUN_QUEUE until RunsModule exports its own; `overrideProvider` replaces either. */
@Global()
@Module({ providers: [{ provide: RUN_QUEUE, useValue: runQueue }], exports: [RUN_QUEUE] })
class TestRunQueueModule {}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const anIsoTimestamp: unknown = expect.stringMatching(ISO);
const aNumber: unknown = expect.any(Number);

interface Body {
  readonly id?: number;
  readonly domain?: string | null;
  readonly message?: string | readonly string[];
}

/** The JSON body, typed loosely for assertions. */
function arrayContaining(items: readonly string[]): unknown {
  const matcher: unknown = expect.arrayContaining(items);
  return matcher;
}

const queuedBackfill: unknown = expect.objectContaining({ id: 1, status: 'queued', type: 'backfill' });

function bodyOf(response: { body: unknown }): Body {
  return response.body as Body;
}

function itemsOf(response: { body: unknown }): readonly Body[] {
  return response.body as readonly Body[];
}

describe('/api/admin/companies (CompaniesModule against Postgres)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, DatabaseModule, TestRunQueueModule, CompaniesModule],
    })
      .overrideProvider(RUN_QUEUE)
      .useValue(runQueue)
      .compile();
    app = configureApiApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE "tracked_companies" RESTART IDENTITY CASCADE');
    runQueue.runs.length = 0;
  });

  afterAll(async () => {
    await dataSource.query('TRUNCATE "tracked_companies" RESTART IDENTITY CASCADE');
    await app.close();
  });

  function server(): App {
    return app.getHttpServer();
  }

  /** Inserts a Seed List company the way the import does (the API cannot set a Source Name). */
  async function insertSeed(
    sourceName: string,
    displayName: string,
    status: 'active' | 'needs_review' | 'deactivated',
    extra: { aliases?: string[]; domain?: string; reviewReason?: string } = {},
  ): Promise<number> {
    const rows: { id: number }[] = await dataSource.query(
      `INSERT INTO "tracked_companies" ("source_name", "display_name", "aliases", "domain", "status", "review_reason")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
      [sourceName, displayName, extra.aliases ?? [], extra.domain ?? null, status, extra.reviewReason ?? null],
    );
    const id = rows[0]?.id;
    if (id === undefined) throw new Error('insert returned no id');
    return id;
  }

  describe('GET', () => {
    it('lists every status ordered by display name, in the AdminCompany shape', async () => {
      await insertSeed('Lambda (lambda.ai)', 'Lambda', 'active', { domain: 'lambda.ai' });
      await insertSeed('Harvey', 'Harvey', 'needs_review', {
        reviewReason: '"Harvey" is a common first name, so a news search for it would mostly return unrelated people.',
      });
      await insertSeed('Ludeo (formerly Edge)', 'Ludeo', 'deactivated', { aliases: ['Edge'] });

      const response = await request(server()).get('/api/admin/companies').expect(200);

      expect((response.body as { displayName: string }[]).map((company) => company.displayName)).toEqual([
        'Harvey',
        'Lambda',
        'Ludeo',
      ]);
      expect(itemsOf(response)[1]).toEqual({
        id: aNumber,
        sourceName: 'Lambda (lambda.ai)',
        displayName: 'Lambda',
        aliases: [],
        domain: 'lambda.ai',
        description: null,
        searchTerms: [],
        status: 'active',
        reviewReason: null,
        coverageCapped: false,
        createdAt: anIsoTimestamp,
        updatedAt: anIsoTimestamp,
      });
    });

    it('filters by status and by q over display name, aliases and Source Name', async () => {
      await insertSeed('Lambda (lambda.ai)', 'Lambda', 'active', { domain: 'lambda.ai' });
      await insertSeed('Harvey', 'Harvey', 'needs_review', { reviewReason: 'flagged' });
      await insertSeed('Ludeo (formerly Edge)', 'Ludeo', 'deactivated', { aliases: ['Edge'] });

      const names = async (query: string): Promise<string[]> => {
        const response = await request(server()).get(`/api/admin/companies${query}`).expect(200);
        return (response.body as { displayName: string }[]).map((company) => company.displayName);
      };

      expect(await names('?status=needs_review')).toEqual(['Harvey']);
      expect(await names('?q=edge')).toEqual(['Ludeo']);
      expect(await names('?q=LAMBDA.AI')).toEqual(['Lambda']);
      expect(await names('?q=%25')).toEqual([]);
      expect(await names('?q=%20%20')).toHaveLength(3);
      expect(await names('?status=deactivated&q=lud')).toEqual(['Ludeo']);
    });

    it('rejects an unknown status or an unknown query parameter', async () => {
      const bad = await request(server()).get('/api/admin/companies?status=paused').expect(400);
      expect(bodyOf(bad).message).toEqual([
        'status must be one of the following values: active, needs_review, deactivated',
      ]);
      await request(server()).get('/api/admin/companies?sort=name').expect(400);
    });
  });

  describe('POST', () => {
    it('adds a company by hand: active, no Source Name, trimmed and normalised', async () => {
      const response = await request(server())
        .post('/api/admin/companies')
        .send({
          displayName: '  Quantum Machines ',
          aliases: [' QM '],
          domain: ' Quantum-Machines.co ',
          description: '',
          searchTerms: ['"Quantum Machines"'],
        })
        .expect(201);

      expect(response.body).toMatchObject({
        sourceName: null,
        displayName: 'Quantum Machines',
        aliases: ['QM'],
        domain: 'quantum-machines.co',
        description: null,
        searchTerms: ['"Quantum Machines"'],
        status: 'active',
        reviewReason: null,
      });
    });

    it('accepts only a display name, as the frontend may send', async () => {
      const response = await request(server())
        .post('/api/admin/companies')
        .send({ displayName: 'Hand Added', aliases: [], domain: null, description: null, searchTerms: [] })
        .expect(201);
      expect(response.body).toMatchObject({ displayName: 'Hand Added', domain: null, searchTerms: [] });
    });

    it('answers 400 with messages that start with the field they concern', async () => {
      const response = await request(server())
        .post('/api/admin/companies')
        .send({ displayName: '   ', domain: 'not a domain', aliases: ['ok', ''], searchTerms: [' '] })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: arrayContaining([
          'displayName must not be empty',
          'domain must be a valid hostname, e.g. lambda.ai',
          'each value in aliases must not be empty',
          'each value in searchTerms must not be empty',
        ]),
      });
    });

    it('answers 400 for a missing display name and for a Source Name', async () => {
      const missing = await request(server()).post('/api/admin/companies').send({}).expect(400);
      expect(bodyOf(missing).message).toContain('displayName must be a string');

      const withSource = await request(server())
        .post('/api/admin/companies')
        .send({ displayName: 'Hand Added', sourceName: 'Hand Added' })
        .expect(400);
      expect(bodyOf(withSource).message).toEqual(['property sourceName should not exist']);
    });

    it('answers 409 for a display name a live company already has (case-insensitive)', async () => {
      await insertSeed('Harvey', 'Harvey', 'needs_review', { reviewReason: 'flagged' });

      const response = await request(server()).post('/api/admin/companies').send({ displayName: 'HARVEY' }).expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: ['displayName "HARVEY" is already used by another company that is not deactivated'],
      });
    });

    it('allows the name of a deactivated company: re-adding creates a new company', async () => {
      const old = await insertSeed('Ludeo (formerly Edge)', 'Ludeo', 'deactivated', { aliases: ['Edge'] });

      const response = await request(server()).post('/api/admin/companies').send({ displayName: 'Ludeo' }).expect(201);

      expect(bodyOf(response).id).not.toBe(old);
      const all = await request(server()).get('/api/admin/companies?q=ludeo').expect(200);
      expect(all.body).toHaveLength(2);
    });
  });

  describe('PATCH /:id', () => {
    it('edits only the fields sent and keeps the Source Name', async () => {
      const id = await insertSeed('Lambda (lambda.ai)', 'Lambda', 'active', { domain: 'lambda.ai' });

      const response = await request(server())
        .patch(`/api/admin/companies/${id}`)
        .send({ searchTerms: ['"Lambda" GPU cloud'], description: 'GPU cloud for AI training and inference.' })
        .expect(200);

      expect(response.body).toMatchObject({
        id,
        sourceName: 'Lambda (lambda.ai)',
        displayName: 'Lambda',
        domain: 'lambda.ai',
        description: 'GPU cloud for AI training and inference.',
        searchTerms: ['"Lambda" GPU cloud'],
      });
    });

    it('clears domain and description with null', async () => {
      const id = await insertSeed('Lambda (lambda.ai)', 'Lambda', 'active', { domain: 'lambda.ai' });

      const response = await request(server()).patch(`/api/admin/companies/${id}`).send({ domain: null }).expect(200);

      expect(bodyOf(response).domain).toBeNull();
    });

    it('answers 400 when sourceName or status is sent, leaving the company unchanged', async () => {
      const id = await insertSeed('Lambda (lambda.ai)', 'Lambda', 'active');

      const source = await request(server())
        .patch(`/api/admin/companies/${id}`)
        .send({ sourceName: 'Lambda', displayName: 'Lambda Labs' })
        .expect(400);
      expect(bodyOf(source).message).toEqual(['property sourceName should not exist']);
      await request(server()).patch(`/api/admin/companies/${id}`).send({ status: 'active' }).expect(400);

      const after = await request(server()).get('/api/admin/companies').expect(200);
      expect(itemsOf(after)[0]).toMatchObject({ sourceName: 'Lambda (lambda.ai)', displayName: 'Lambda' });
    });

    it('answers 400 for a null display name, an invalid domain or a blank search term', async () => {
      const id = await insertSeed('Lambda (lambda.ai)', 'Lambda', 'active');

      const response = await request(server())
        .patch(`/api/admin/companies/${id}`)
        .send({ displayName: null, domain: 'https://lambda.ai/', searchTerms: [''] })
        .expect(400);

      expect(bodyOf(response).message).toEqual(
        arrayContaining([
          'displayName must be a string',
          'domain must be a valid hostname, e.g. lambda.ai',
          'each value in searchTerms must not be empty',
        ]),
      );
    });

    it('answers 409 when renaming onto a live company, 404 for an unknown id, 400 for a bad id', async () => {
      await insertSeed('Harvey', 'Harvey', 'active');
      const id = await insertSeed('Wave', 'Wave', 'active');

      const clash = await request(server()).patch(`/api/admin/companies/${id}`).send({ displayName: 'harvey' }).expect(409);
      expect(bodyOf(clash).message).toEqual(['displayName "harvey" is already used by another company that is not deactivated']);
      const missing = await request(server()).patch('/api/admin/companies/9999').send({ description: 'x' }).expect(404);
      expect(bodyOf(missing).message).toBe('Tracked Company 9999 does not exist');
      await request(server()).patch('/api/admin/companies/abc').send({}).expect(400);
    });
  });

  describe('status actions', () => {
    it('review: Needs Review → active, clearing the reason, returning the company', async () => {
      const id = await insertSeed('Harvey', 'Harvey', 'needs_review', { reviewReason: 'flagged' });

      const response = await request(server()).post(`/api/admin/companies/${id}/review`).expect(200);

      expect(response.body).toMatchObject({ id, status: 'active', reviewReason: null, sourceName: 'Harvey' });
    });

    it('needs-review: active → Needs Review with a reason', async () => {
      const id = await insertSeed('Wave', 'Wave', 'active');

      const response = await request(server()).post(`/api/admin/companies/${id}/needs-review`).expect(200);

      expect(response.body).toMatchObject({
        id,
        status: 'needs_review',
        reviewReason: 'Sent back to Needs Review from the companies page.',
      });
    });

    it('deactivate keeps the row and its history, frees the name and blocks further changes', async () => {
      const id = await insertSeed('Ludeo (formerly Edge)', 'Ludeo', 'active', { aliases: ['Edge'] });

      const response = await request(server()).post(`/api/admin/companies/${id}/deactivate`).expect(200);
      expect(response.body).toMatchObject({ id, status: 'deactivated', sourceName: 'Ludeo (formerly Edge)' });

      const listed = await request(server()).get('/api/admin/companies?status=deactivated').expect(200);
      expect(listed.body).toHaveLength(1);
      const again = await request(server()).post(`/api/admin/companies/${id}/review`).expect(409);
      expect(bodyOf(again).message).toBe('Cannot mark as reviewed: Ludeo is deactivated');
      await request(server()).post(`/api/admin/companies/${id}/deactivate`).expect(409);
      const edit = await request(server()).patch(`/api/admin/companies/${id}`).send({ description: 'x' }).expect(409);
      expect(bodyOf(edit).message).toBe('Cannot edit: Ludeo is deactivated');
    });

    it('answers 409 for a transition that does not apply, 404 for an unknown id', async () => {
      const id = await insertSeed('Wave', 'Wave', 'active');

      const response = await request(server()).post(`/api/admin/companies/${id}/review`).expect(409);
      expect(response.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'Cannot mark as reviewed: Wave is already active',
      });
      await request(server()).post('/api/admin/companies/9999/needs-review').expect(404);
    });
  });

  describe('POST /:id/reprocess', () => {
    it('answers 202 with the queued single-company Backfill', async () => {
      const id = await insertSeed('Lambda (lambda.ai)', 'Lambda', 'active');

      const response = await request(server()).post(`/api/admin/companies/${id}/reprocess`).expect(202);

      expect(response.body).toEqual({
        id: 1,
        type: 'backfill',
        status: 'queued',
        trigger: 'dashboard',
        params: { until: null, companyIds: [id], reprocess: true },
        progress: null,
        error: null,
        createdAt: anIsoTimestamp,
        startedAt: null,
        finishedAt: null,
      });
    });

    it('answers 409 with {message, activeRun} while another Run is active', async () => {
      const id = await insertSeed('Lambda (lambda.ai)', 'Lambda', 'active');
      await request(server()).post(`/api/admin/companies/${id}/reprocess`).expect(202);

      const response = await request(server()).post(`/api/admin/companies/${id}/reprocess`).expect(409);

      expect(response.body).toEqual({
        message: 'Another Run is already queued; re-process once it has finished',
        activeRun: queuedBackfill,
      });
    });

    it('answers 409 for a Needs Review or deactivated company, queueing nothing', async () => {
      const review = await insertSeed('Harvey', 'Harvey', 'needs_review', { reviewReason: 'flagged' });
      const gone = await insertSeed('Ludeo (formerly Edge)', 'Ludeo', 'deactivated');

      const first = await request(server()).post(`/api/admin/companies/${review}/reprocess`).expect(409);
      expect(bodyOf(first).message).toBe('Only an active company can be re-processed; Harvey is in Needs Review');
      const second = await request(server()).post(`/api/admin/companies/${gone}/reprocess`).expect(409);
      expect(bodyOf(second).message).toBe('Only an active company can be re-processed; Ludeo is deactivated');
      expect(runQueue.runs).toEqual([]);
    });

    it('answers 404 for an unknown company', async () => {
      await request(server()).post('/api/admin/companies/9999/reprocess').expect(404);
    });
  });
});
