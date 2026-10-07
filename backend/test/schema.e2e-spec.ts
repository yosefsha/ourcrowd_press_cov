import { DataSource, type QueryRunner } from 'typeorm';

import { configuration } from '../src/config/configuration';
import { buildTypeOrmOptions } from '../src/database/typeorm-options';

/**
 * The schema's own guarantees, checked against the migrated Postgres. Every
 * test runs inside a transaction that is rolled back, so nothing persists.
 */
describe('database schema (against migrated Postgres)', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;

  beforeAll(async () => {
    dataSource = await new DataSource(buildTypeOrmOptions(configuration().database.url)).initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    runner = dataSource.createQueryRunner();
    await runner.startTransaction();
  });

  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.release();
  });

  async function query<T = Record<string, unknown>>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    return (await runner.query(sql, parameters)) as T[];
  }

  /** Runs `sql` expecting it to violate `constraint`, keeping the transaction usable. */
  async function expectViolation(sql: string, constraint: string, parameters: unknown[] = []): Promise<void> {
    await runner.query('SAVEPOINT attempt');
    await expect(runner.query(sql, parameters)).rejects.toMatchObject({ driverError: { constraint } });
    await runner.query('ROLLBACK TO SAVEPOINT attempt');
  }

  async function insertCompany(displayName: string, sourceName: string | null, status = 'active'): Promise<number> {
    const [row] = await query<{ id: number }>(
      `INSERT INTO tracked_companies (source_name, display_name, status) VALUES ($1, $2, $3) RETURNING id`,
      [sourceName, displayName, status],
    );
    return row.id;
  }

  async function insertRun(status: string): Promise<number> {
    const [row] = await query<{ id: number }>(
      `INSERT INTO runs (type, status, params, trigger) VALUES ('backfill', $1, $2, 'dashboard') RETURNING id`,
      [status, JSON.stringify({ until: null, companyIds: null, reprocess: false })],
    );
    return row.id;
  }

  async function insertArticle(googleArticleId: string): Promise<number> {
    const [row] = await query<{ id: number }>(
      `INSERT INTO articles (google_article_id, title, snippet, outlet_name, outlet_url, google_url, published_at, language, edition)
       VALUES ($1, 'Title', '', 'Reuters', 'https://www.reuters.com', 'https://news.google.com/rss/articles/' || $1, now(), 'en', 'en-US')
       RETURNING id`,
      [googleArticleId],
    );
    return row.id;
  }

  it('has no migration left to apply', async () => {
    await expect(dataSource.showMigrations()).resolves.toBe(false);
  });

  it('creates every table of the plan', async () => {
    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename`,
    );

    expect(tables.map((table) => table.tablename)).toEqual(
      expect.arrayContaining([
        'alert_digest_items',
        'alert_digests',
        'articles',
        'candidates',
        'collector_heartbeat',
        'run_company_errors',
        'runs',
        'tracked_companies',
      ]),
    );
  });

  describe('tracked_companies', () => {
    it('keeps display names unique case-insensitively among companies that are not deactivated', async () => {
      await insertCompany('Harvey', 'Harvey');

      await expectViolation(
        `INSERT INTO tracked_companies (display_name, status) VALUES ('HARVEY', 'needs_review')`,
        'UQ_tracked_companies_display_name_live',
      );
    });

    it('lets a deactivated company share its display name with a new one', async () => {
      await insertCompany('Wave', null, 'deactivated');

      await expect(insertCompany('wave', null)).resolves.toEqual(expect.any(Number));
    });

    it('keeps Source Names unique but allows any number of hand-added companies', async () => {
      await insertCompany('Island', 'Island');
      await insertCompany('Manual One', null);
      await insertCompany('Manual Two', null);

      await expectViolation(
        `INSERT INTO tracked_companies (source_name, display_name, status) VALUES ('Island', 'Island 2', 'active')`,
        'UQ_tracked_companies_source_name',
      );
    });

    it('defaults to empty aliases and search terms and uncapped coverage', async () => {
      const id = await insertCompany('Ro', 'Ro');
      const [row] = await query(`SELECT aliases, search_terms, coverage_capped FROM tracked_companies WHERE id = $1`, [id]);

      expect(row).toEqual({ aliases: [], search_terms: [], coverage_capped: false });
    });
  });

  describe('runs', () => {
    it('allows only one queued or running Run at a time', async () => {
      await insertRun('queued');

      await expectViolation(
        `INSERT INTO runs (type, status, params, trigger) VALUES ('daily_check', 'running', '{}', 'schedule')`,
        'UQ_runs_one_active',
      );
    });

    it('keeps any number of finished Runs alongside the active one', async () => {
      await insertRun('completed');
      await insertRun('failed');
      await insertRun('interrupted');

      await expect(insertRun('running')).resolves.toEqual(expect.any(Number));
    });
  });

  describe('candidates', () => {
    let companyId: number;
    let articleId: number;
    let runId: number;

    beforeEach(async () => {
      companyId = await insertCompany('Kando', 'Kando');
      articleId = await insertArticle('CBMiTestArticle');
      runId = await insertRun('running');
    });

    function insertCandidate(columns = '', values = ''): Promise<unknown> {
      return runner.query(
        `INSERT INTO candidates (article_id, company_id, fetched_in_run_id${columns}) VALUES ($1, $2, $3${values})`,
        [articleId, companyId, runId],
      );
    }

    it('starts pending and accepts a confirmed Mention with a Sentiment', async () => {
      await insertCandidate();
      await runner.query(
        `UPDATE candidates SET relevance = 'relevant', relevance_method = 'llm', sentiment = 'negative',
                confirmed_in_run_id = $1, confirmed_at = now() WHERE article_id = $2`,
        [runId, articleId],
      );

      const [row] = await query(`SELECT relevance, sentiment FROM candidates WHERE article_id = $1`, [articleId]);
      expect(row).toEqual({ relevance: 'relevant', sentiment: 'negative' });
    });

    it('holds one Candidate per (Article, Tracked Company)', async () => {
      await insertCandidate();

      await expectViolation(
        `INSERT INTO candidates (article_id, company_id, fetched_in_run_id) VALUES ($1, $2, $3)`,
        'UQ_candidates_article_company',
        [articleId, companyId, runId],
      );
    });

    it('gives a Sentiment only to Mentions', async () => {
      await expectViolation(
        `INSERT INTO candidates (article_id, company_id, fetched_in_run_id, relevance, relevance_method, sentiment)
         VALUES ($1, $2, $3, 'rejected', 'name_absent', 'positive')`,
        'CHK_candidates_only_mentions_confirmed',
        [articleId, companyId, runId],
      );
    });

    it('records how every judged Candidate was judged, and nothing for a pending one', async () => {
      await expectViolation(
        `INSERT INTO candidates (article_id, company_id, fetched_in_run_id, relevance) VALUES ($1, $2, $3, 'rejected')`,
        'CHK_candidates_method_iff_judged',
        [articleId, companyId, runId],
      );
      await expectViolation(
        `INSERT INTO candidates (article_id, company_id, fetched_in_run_id, relevance_method) VALUES ($1, $2, $3, 'llm')`,
        'CHK_candidates_method_iff_judged',
        [articleId, companyId, runId],
      );
    });

    it('deletes digest entries with their Candidate (Re-process replaces history)', async () => {
      const [candidate] = await query<{ id: number }>(
        `INSERT INTO candidates (article_id, company_id, fetched_in_run_id, relevance, relevance_method, confirmed_in_run_id, confirmed_at, sentiment)
         VALUES ($1, $2, $3, 'relevant', 'llm', $3, now(), 'neutral') RETURNING id`,
        [articleId, companyId, runId],
      );
      const [digest] = await query<{ id: number }>(`INSERT INTO alert_digests (run_id) VALUES ($1) RETURNING id`, [runId]);
      await runner.query(`INSERT INTO alert_digest_items (digest_id, candidate_id) VALUES ($1, $2)`, [digest.id, candidate.id]);

      await runner.query(`DELETE FROM candidates WHERE id = $1`, [candidate.id]);

      await expect(query(`SELECT * FROM alert_digest_items WHERE digest_id = $1`, [digest.id])).resolves.toEqual([]);
    });

    it('never deletes a Tracked Company that has Candidates', async () => {
      await insertCandidate();

      await expectViolation(`DELETE FROM tracked_companies WHERE id = $1`, 'FK_candidates_company', [companyId]);
    });
  });

  it('allows one Alert Digest per Run', async () => {
    const runId = await insertRun('completed');
    await runner.query(`INSERT INTO alert_digests (run_id) VALUES ($1)`, [runId]);

    await expectViolation(`INSERT INTO alert_digests (run_id) VALUES ($1)`, 'UQ_alert_digests_run', [runId]);
  });

  it('keeps the collector heartbeat to a single row', async () => {
    await runner.query(`DELETE FROM collector_heartbeat`);
    await runner.query(`INSERT INTO collector_heartbeat (last_seen_at, state) VALUES (now(), 'idle')`);

    await expectViolation(
      `INSERT INTO collector_heartbeat (id, last_seen_at, state) VALUES (2, now(), 'idle')`,
      'CHK_collector_heartbeat_single_row',
    );
    await expectViolation(
      `INSERT INTO collector_heartbeat (last_seen_at, state) VALUES (now(), 'running')`,
      'PK_collector_heartbeat',
    );
  });
});
