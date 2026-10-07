import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { InMemoryAlertNotifier } from '../src/alerts/notifiers/in-memory-alert-notifier';
import { NewMentionAlertDigestBuilder } from '../src/alerts/notifiers/new-mention-alert-digest.builder';
import { PostgresAlertDigestStore } from '../src/alerts/notifiers/postgres-alert-digest.store';
import { ApiModule } from '../src/api.module';
import { configureApiApp } from '../src/configure-api-app';
import { RECORDED_ARTICLES } from './fixtures/alerts/recorded-google-news-articles';

type ArticleKey = keyof typeof RECORDED_ARTICLES;

// Three days after the newest recorded articles (2026-09-30); ZutaCore's
// Business Wire story (2026-09-23) is then 10 days old.
const NOW = new Date('2026-10-03T07:00:00Z');

/**
 * Alert Digests end to end against the migrated Postgres: the collector's
 * builder stores a digest from Mentions inserted with recorded Google News
 * articles, and the API serves and acknowledges it. Sentiments are verdicts
 * listed here explicitly (no recorded classifier verdicts exist yet, #6).
 * Every row this spec inserts is deleted afterwards.
 */
describe('Alert Digests (ApiModule and the collector builder against Postgres)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const notifier = new InMemoryAlertNotifier();
  let builder: NewMentionAlertDigestBuilder;

  const companyIds = new Map<string, number>();
  const articleIds = new Map<ArticleKey, number>();
  const runIds: number[] = [];
  const candidateIds: Record<string, number> = {};
  let failedRun: number;
  let dailyCheck: number;
  let emptyDailyCheck: number;

  async function insert(sql: string, parameters: unknown[]): Promise<number> {
    const [row] = await dataSource.query<{ id: number }[]>(`${sql} RETURNING id`, parameters);
    return row.id;
  }

  async function insertRun(status: string): Promise<number> {
    const id = await insert(
      `INSERT INTO runs (type, status, params, trigger) VALUES ('daily_check', $1, $2, 'schedule')`,
      [status, JSON.stringify({ until: null, companyIds: null, reprocess: false })],
    );
    runIds.push(id);
    return id;
  }

  async function insertArticle(key: ArticleKey): Promise<number> {
    const { article, company } = RECORDED_ARTICLES[key];
    if (!companyIds.has(company)) {
      companyIds.set(
        company,
        await insert(`INSERT INTO tracked_companies (source_name, display_name, status) VALUES ($1, $1, 'active')`, [company]),
      );
    }
    const id = await insert(
      `INSERT INTO articles (google_article_id, title, snippet, outlet_name, outlet_url, google_url,
                             publisher_url, published_at, language, edition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        article.googleArticleId,
        article.title,
        article.snippet,
        article.outletName,
        article.outletUrl,
        article.googleUrl,
        article.publisherUrl,
        article.publishedAt,
        article.language,
        article.edition,
      ],
    );
    articleIds.set(key, id);
    return id;
  }

  /** A Mention confirmed in `confirmedIn`, or a rejected Candidate when `sentiment` is null. */
  async function insertCandidate(
    name: string,
    key: ArticleKey,
    fetchedIn: number,
    confirmedIn: number | null,
    sentiment: string | null,
  ): Promise<void> {
    const articleId = articleIds.get(key) ?? (await insertArticle(key));
    const relevant = sentiment !== null;
    candidateIds[name] = await insert(
      `INSERT INTO candidates (article_id, company_id, fetched_in_run_id, relevance, relevance_method,
                               relevance_reason, relevance_classified_at, sentiment, sentiment_reason,
                               sentiment_classified_at, confirmed_in_run_id, confirmed_at)
       VALUES ($1, $2, $3, $4, 'llm', $5, now(), $6, $7, $8, $9, $10)`,
      [
        articleId,
        companyIds.get(RECORDED_ARTICLES[key].company),
        fetchedIn,
        relevant ? 'relevant' : 'rejected',
        relevant ? 'The article is about the company.' : 'The article is not about the company.',
        sentiment,
        relevant ? 'Verdict listed by the alerts e2e spec.' : null,
        relevant ? new Date() : null,
        confirmedIn,
        confirmedIn === null ? null : new Date(),
      ],
    );
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiModule] }).compile();
    app = configureApiApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
    await app.init();
    dataSource = app.get(DataSource);
    builder = new NewMentionAlertDigestBuilder(
      new PostgresAlertDigestStore(dataSource),
      [notifier],
      { maxAgeDays: 7 },
      () => NOW,
    );

    failedRun = await insertRun('failed');
    dailyCheck = await insertRun('completed');
    emptyDailyCheck = await insertRun('completed');

    // Fetched by the failed Run, left unclassified, confirmed by the next Daily Check.
    await insertCandidate('lateConfirmed', 'zutacoreDcdPartnership', failedRun, dailyCheck, 'negative');
    await insertCandidate('fresh', 'morphisecAiTrust', dailyCheck, dailyCheck, 'positive');
    await insertCandidate('stale', 'zutacoreBusinessWirePartnership', dailyCheck, dailyCheck, 'positive');
    await insertCandidate('confirmedEarlier', 'zutacoreFunding', failedRun, failedRun, 'positive');
    await insertCandidate('rejected', 'oncohostAward', dailyCheck, null, null);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM alert_digests WHERE run_id = ANY($1::int[])`, [runIds]);
      await dataSource.query(`DELETE FROM candidates WHERE id = ANY($1::int[])`, [Object.values(candidateIds)]);
      await dataSource.query(`DELETE FROM articles WHERE id = ANY($1::int[])`, [[...articleIds.values()]]);
      await dataSource.query(`DELETE FROM runs WHERE id = ANY($1::int[])`, [runIds]);
      await dataSource.query(`DELETE FROM tracked_companies WHERE id = ANY($1::int[])`, [[...companyIds.values()]]);
    }
    await app?.close();
  });

  function server(): App {
    return app.getHttpServer();
  }

  let digestId: number;

  describe('building (collector)', () => {
    beforeAll(() => {
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('stores one digest of the New Mentions, negatives first, and notifies once', async () => {
      const digest = await builder.buildForRun(dailyCheck);

      expect(digest).not.toBeNull();
      digestId = digest?.id ?? 0;
      expect(digest?.runId).toBe(dailyCheck);
      expect(digest?.companies.map((group) => [group.displayName, group.mentions.map((m) => m.candidateId)])).toEqual([
        ['ZutaCore', [candidateIds.lateConfirmed]],
        ['Morphisec', [candidateIds.fresh]],
      ]);
      expect(digest?.companies[0].mentions[0]).toMatchObject({
        sentiment: 'negative',
        title: RECORDED_ARTICLES.zutacoreDcdPartnership.article.title,
        outletName: 'Data Center Dynamics',
        url: RECORDED_ARTICLES.zutacoreDcdPartnership.article.googleUrl,
      });
      expect(notifier.delivered).toEqual([digest]);
    });

    it('returns the stored digest without notifying again when built twice', async () => {
      const again = await builder.buildForRun(dailyCheck);

      expect(again?.id).toBe(digestId);
      expect(notifier.delivered).toHaveLength(1);
    });

    it('stores nothing for a Daily Check with no New Mentions', async () => {
      await expect(builder.buildForRun(emptyDailyCheck)).resolves.toBeNull();

      const rows = await dataSource.query<unknown[]>(`SELECT 1 FROM alert_digests WHERE run_id = $1`, [emptyDailyCheck]);
      expect(rows).toHaveLength(0);
    });
  });

  describe('GET /api/alerts', () => {
    it('lists the unacknowledged digest with its counts', async () => {
      const response = await request(server()).get('/api/alerts?acknowledged=false').expect(200);

      const listed = (response.body as { id: number }[]).find((digest) => digest.id === digestId);
      expect(listed).toEqual({
        id: digestId,
        runId: dailyCheck,
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) as unknown,
        acknowledgedAt: null,
        mentionCount: 2,
        companyCount: 2,
        negativeMentionCount: 1,
      });
    });

    it('rejects an acknowledged value that is not true or false', async () => {
      await request(server()).get('/api/alerts?acknowledged=maybe').expect(400);
    });

    it('rejects unknown query parameters', async () => {
      await request(server()).get('/api/alerts?limit=5').expect(400);
    });
  });

  describe('GET /api/alerts/:id', () => {
    it('returns the full digest grouped by company, with each Article', async () => {
      const response = await request(server()).get(`/api/alerts/${digestId}`).expect(200);
      const article = RECORDED_ARTICLES.zutacoreDcdPartnership.article;

      expect(response.body).toMatchObject({ id: digestId, runId: dailyCheck, mentionCount: 2, negativeMentionCount: 1 });
      const { companies } = response.body as { companies: unknown[] };
      expect(companies).toEqual([
        {
          companyId: companyIds.get('ZutaCore'),
          displayName: 'ZutaCore',
          mentions: [
            {
              candidateId: candidateIds.lateConfirmed,
              sentiment: 'negative',
              article: {
                id: articleIds.get('zutacoreDcdPartnership'),
                title: article.title,
                snippet: article.snippet,
                outletName: article.outletName,
                outletUrl: article.outletUrl,
                googleUrl: article.googleUrl,
                publisherUrl: null,
                publishedAt: article.publishedAt.toISOString(),
                language: 'en',
                edition: 'en-US',
              },
            },
          ],
        },
        expect.objectContaining({ displayName: 'Morphisec' }),
      ]);
    });

    it('answers 404 for a digest that does not exist', async () => {
      const response = await request(server()).get('/api/alerts/2147483647').expect(404);

      expect(response.body).toMatchObject({ message: 'Alert Digest 2147483647 not found' });
    });

    it('answers 404, not a database error, for an id beyond the column range', async () => {
      await request(server()).get('/api/alerts/99999999999').expect(404);
    });

    it('answers 400 for an id that is not a positive integer', async () => {
      await request(server()).get('/api/alerts/abc').expect(400);
      await request(server()).get('/api/alerts/0').expect(400);
    });
  });

  describe('POST /api/alerts/:id/acknowledge', () => {
    it('acknowledges the digest, and a second acknowledgement changes nothing', async () => {
      const first = await request(server()).post(`/api/alerts/${digestId}/acknowledge`).expect(200);
      const second = await request(server()).post(`/api/alerts/${digestId}/acknowledge`).expect(200);

      const acknowledgedAt = (first.body as { acknowledgedAt: string | null }).acknowledgedAt;
      expect(acknowledgedAt).toEqual(expect.any(String));
      expect(second.body).toEqual(first.body);
      expect(first.body).toMatchObject({ id: digestId, mentionCount: 2, companyCount: 2, negativeMentionCount: 1 });
    });

    it('moves the digest from the unacknowledged list to the acknowledged one', async () => {
      const unacknowledged = await request(server()).get('/api/alerts?acknowledged=false').expect(200);
      const acknowledged = await request(server()).get('/api/alerts?acknowledged=true').expect(200);
      const all = await request(server()).get('/api/alerts').expect(200);

      const ids = (body: unknown): number[] => (body as { id: number }[]).map((digest) => digest.id);
      expect(ids(unacknowledged.body)).not.toContain(digestId);
      expect(ids(acknowledged.body)).toContain(digestId);
      expect(ids(all.body)).toContain(digestId);
    });

    it('answers 404 for a digest that does not exist', async () => {
      await request(server()).post('/api/alerts/2147483647/acknowledge').expect(404);
    });
  });
});
