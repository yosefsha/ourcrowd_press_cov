import { DataSource, type EntityManager, type QueryRunner } from 'typeorm';

import type { TrackedCompanyFilter } from '../src/companies/tracked-company.repository';
import { configuration } from '../src/config/configuration';
import { buildTypeOrmOptions } from '../src/database/typeorm-options';
import type { TrackedCompany, TrackedCompanyStatus } from '../src/domain/company';
import type { RunType } from '../src/domain/run';
import { CandidateStoreFailed } from '../src/pipeline/candidate.repository';
import type { PipelineCompanies } from '../src/pipeline/company-collection.service';
import { PostgresCandidateRepository } from '../src/pipeline/repositories/postgres.candidate.repository';
import { PostgresRunHistory } from '../src/pipeline/repositories/postgres.run-history';
import { RecordingProgress } from './pipeline/support/in-memory-pipeline-ports';
import { AFTER_RECORDINGS, claimedRun, type PipelineWorld, pipelineWorld } from './pipeline/support/pipeline-world';

interface CompanyRow {
  id: number;
  display_name: string;
  aliases: string[];
  status: TrackedCompanyStatus;
  coverage_capped: boolean;
}

/**
 * The slice of the company repository the pipeline needs, over the real
 * `tracked_companies` table. Test-only: the real repository is #7's.
 */
class SqlPipelineCompanies implements PipelineCompanies {
  constructor(private readonly manager: EntityManager) {}

  async list(filter: TrackedCompanyFilter = {}): Promise<readonly TrackedCompany[]> {
    const rows = await this.manager.query<CompanyRow[]>(
      `SELECT id, display_name, aliases, status, coverage_capped FROM tracked_companies
        WHERE ($1::tracked_company_status[] IS NULL OR status = ANY($1))
          AND ($2::int[] IS NULL OR id = ANY($2))
        ORDER BY display_name`,
      [filter.statuses ?? null, filter.ids ?? null],
    );
    return rows.map((row) => ({
      id: row.id,
      sourceName: row.display_name,
      status: row.status,
      reviewReason: null,
      coverageCapped: row.coverage_capped,
      profile: { displayName: row.display_name, aliases: row.aliases, domain: null, description: null, searchTerms: [] },
      createdAt: AFTER_RECORDINGS,
      updatedAt: AFTER_RECORDINGS,
    }));
  }

  async recordCoverageCapped(id: number, capped: boolean): Promise<void> {
    await this.manager.query(`UPDATE tracked_companies SET coverage_capped = $2 WHERE id = $1`, [id, capped]);
  }
}

/**
 * Backfill then Daily Check over the recorded Google News fixtures, storing in
 * the migrated Postgres. Everything runs inside one transaction that is rolled
 * back, so the database is left as it was found.
 */
describe('Backfill and Daily Check against Postgres', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  let world: PipelineWorld;
  let ids: Record<'cerebras' | 'groq' | 'innoviz' | 'arbe', number>;

  async function query<T>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    return (await runner.query(sql, parameters)) as T[];
  }

  async function insertCompany(name: string, status: TrackedCompanyStatus, aliases: string[] = []): Promise<number> {
    const [row] = await query<{ id: number }>(
      `INSERT INTO tracked_companies (display_name, aliases, status) VALUES ($1, $2, $3) RETURNING id`,
      [name, aliases, status],
    );
    return row?.id ?? Number.NaN;
  }

  async function startRun(type: RunType, startedAt = AFTER_RECORDINGS): Promise<number> {
    const [row] = await query<{ id: number }>(
      `INSERT INTO runs (type, status, params, trigger, started_at) VALUES ($1, 'running', '{}', 'dashboard', $2) RETURNING id`,
      [type, startedAt],
    );
    return row?.id ?? Number.NaN;
  }

  async function finishRun(id: number, status: 'completed' | 'failed'): Promise<void> {
    await query(`UPDATE runs SET status = $2, finished_at = now() WHERE id = $1`, [id, status]);
  }

  async function candidates(companyId: number): Promise<
    { title: string; google_article_id: string; article_id: number; relevance: string; relevance_method: string | null; sentiment: string | null; fetched_in_run_id: number; confirmed_in_run_id: number | null }[]
  > {
    return query(
      `SELECT a.title, a.google_article_id, c.article_id, c.relevance, c.relevance_method, c.sentiment,
              c.fetched_in_run_id, c.confirmed_in_run_id
         FROM candidates c JOIN articles a ON a.id = c.article_id
        WHERE c.company_id = $1 ORDER BY a.published_at DESC, c.id`,
      [companyId],
    );
  }

  beforeAll(async () => {
    dataSource = await new DataSource(buildTypeOrmOptions(configuration().database.url)).initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    // Fixture names may already exist in a developer database; inside this
    // rolled-back transaction they are set aside so the unique index allows ours.
    await query(
      `UPDATE tracked_companies SET status = 'deactivated' WHERE lower(display_name) IN ('cerebras', 'groq', 'innoviz', 'arbe robotics')`,
    );
    ids = {
      cerebras: await insertCompany('Cerebras', 'active'),
      groq: await insertCompany('Groq', 'active'),
      innoviz: await insertCompany('Innoviz', 'active', ['אינוויז']),
      arbe: await insertCompany('Arbe Robotics', 'needs_review'),
    };
    world = pipelineWorld({
      companies: new SqlPipelineCompanies(runner.manager),
      candidates: new PostgresCandidateRepository(runner.manager),
      history: new PostgresRunHistory(runner.manager),
    });
  });

  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.release();
  });

  it('Backfill with until, then Daily Check: one Article per Google ID, Mentions stamped with the confirming Run', async () => {
    const backfillId = await startRun('backfill');
    const backfillOutcome = await world.backfill.execute(
      claimedRun(backfillId, 'backfill', { until: '2026-07-23', companyIds: [ids.cerebras, ids.groq, ids.innoviz, ids.arbe] }),
      new RecordingProgress(),
    );
    await finishRun(backfillId, 'completed');

    expect(backfillOutcome).toEqual({ status: 'completed' });
    expect(world.digests.runIds).toEqual([]);
    const cerebrasAfterBackfill = await candidates(ids.cerebras);
    const groqAfterBackfill = await candidates(ids.groq);
    expect(cerebrasAfterBackfill).toHaveLength(7);
    expect(groqAfterBackfill).toHaveLength(6);
    expect(await candidates(ids.innoviz)).toEqual([]);
    expect(await candidates(ids.arbe)).toEqual([]);
    const shared = cerebrasAfterBackfill.filter((c) => groqAfterBackfill.some((g) => g.article_id === c.article_id));
    expect(shared).toHaveLength(4);
    const wccftech = groqAfterBackfill.find((g) => g.title.startsWith('AMD Fires Back'));
    expect(wccftech).toMatchObject({ relevance: 'relevant', sentiment: 'neutral', confirmed_in_run_id: backfillId });
    expect(cerebrasAfterBackfill.find((c) => c.article_id === wccftech?.article_id)).toMatchObject({
      relevance: 'relevant',
      sentiment: 'positive',
    });

    const dailyId = await startRun('daily_check');
    const dailyOutcome = await world.dailyCheck.execute(claimedRun(dailyId, 'daily_check'), new RecordingProgress());

    expect(dailyOutcome).toEqual({ status: 'completed' });
    expect(world.digests.runIds).toEqual([dailyId]);
    const [counts] = await query<{ articles: number; candidates: number; confirmed_now: number; name_absent: number }>(
      `SELECT (SELECT count(*)::int FROM articles a WHERE EXISTS (SELECT 1 FROM candidates c WHERE c.article_id = a.id AND c.company_id = ANY($2))) AS articles,
              (SELECT count(*)::int FROM candidates WHERE company_id = ANY($2)) AS candidates,
              (SELECT count(*)::int FROM candidates WHERE confirmed_in_run_id = $1) AS confirmed_now,
              (SELECT count(*)::int FROM candidates WHERE company_id = ANY($2) AND relevance_method = 'name_absent') AS name_absent`,
      [dailyId, [ids.cerebras, ids.groq, ids.innoviz]],
    );
    expect(counts).toEqual({ articles: 20, candidates: 24, confirmed_now: 8, name_absent: 8 });
    const hebrew = (await candidates(ids.innoviz)).find((c) => c.title.startsWith('אינוויז שוב'));
    expect(hebrew).toMatchObject({ relevance: 'relevant', sentiment: 'negative', fetched_in_run_id: dailyId, confirmed_in_run_id: dailyId });
    const [capped] = await query<{ capped: boolean[] }>(
      `SELECT array_agg(coverage_capped ORDER BY id) AS capped FROM tracked_companies WHERE id = ANY($1)`,
      [[ids.cerebras, ids.groq, ids.innoviz]],
    );
    expect(capped?.capped).toEqual([false, false, false]);
  });

  it('reads the start of the last completed Daily Check, not a failed one, and not the Run itself', async () => {
    const completed = await startRun('daily_check', new Date('2026-07-29T04:00:00Z'));
    await finishRun(completed, 'completed');
    const failed = await startRun('daily_check', new Date('2026-07-30T04:00:00Z'));
    await finishRun(failed, 'failed');
    const current = await startRun('daily_check');

    await world.dailyCheck.execute(claimedRun(current, 'daily_check'), new RecordingProgress());

    expect(world.news.calls[0]?.window.from).toEqual(new Date('2026-07-28T04:00:00Z'));
  });

  it('re-process deletes the company’s Candidates, digest entries and orphaned Articles, then refetches', async () => {
    const first = await startRun('backfill');
    await world.backfill.execute(claimedRun(first, 'backfill'), new RecordingProgress());
    await finishRun(first, 'completed');
    const before = await candidates(ids.cerebras);
    const mention = before.find((c) => c.relevance === 'relevant' && c.title.startsWith('Cerebras stock jumps'));
    const [digest] = await query<{ id: number }>(`INSERT INTO alert_digests (run_id) VALUES ($1) RETURNING id`, [first]);
    await query(
      `INSERT INTO alert_digest_items (digest_id, candidate_id)
       SELECT $1, id FROM candidates WHERE company_id = $2 AND article_id = $3`,
      [digest?.id, ids.cerebras, mention?.article_id],
    );

    const second = await startRun('backfill');
    const outcome = await world.backfill.execute(
      claimedRun(second, 'backfill', { companyIds: [ids.cerebras], reprocess: true }),
      new RecordingProgress(),
    );

    expect(outcome).toEqual({ status: 'completed' });
    const after = await candidates(ids.cerebras);
    expect(after).toHaveLength(8);
    expect(after.every((c) => c.fetched_in_run_id === second)).toBe(true);
    expect(after.filter((c) => c.relevance === 'relevant').every((c) => c.confirmed_in_run_id === second)).toBe(true);
    // A Cerebras-only Article was deleted and stored again; a shared one kept its row.
    expect(after.find((c) => c.title.startsWith('Cerebras stock jumps'))?.article_id).not.toBe(mention?.article_id);
    const sharedBefore = before.find((c) => c.title.startsWith('AMD Fires Back'));
    expect(after.find((c) => c.title.startsWith('AMD Fires Back'))?.article_id).toBe(sharedBefore?.article_id);
    expect(await query(`SELECT 1 FROM alert_digest_items WHERE digest_id = $1`, [digest?.id])).toEqual([]);
    expect((await candidates(ids.groq)).every((g) => g.fetched_in_run_id === first)).toBe(true);
  });

  it('wraps a database failure in CandidateStoreFailed', async () => {
    const repository = new PostgresCandidateRepository(runner.manager);

    await runner.query('SAVEPOINT attempt');
    await expect(repository.recordFound(ids.cerebras, [], Number.NaN)).resolves.toEqual({ created: 0 });
    await expect(repository.pendingFor(Number.NaN)).rejects.toThrow(CandidateStoreFailed);
    await runner.query('ROLLBACK TO SAVEPOINT attempt');
  });
});
