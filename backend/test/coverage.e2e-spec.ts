import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, In } from 'typeorm';

import { ApiModule } from '../src/api.module';
import { configureApiApp } from '../src/configure-api-app';
import { COVERAGE_CLOCK, COVERAGE_SETTINGS, type Clock } from '../src/coverage/coverage-settings';
import { ArticleEntity } from '../src/database/entities/article.entity';
import { CandidateEntity } from '../src/database/entities/candidate.entity';
import { RunEntity } from '../src/database/entities/run.entity';
import { TrackedCompanyEntity } from '../src/database/entities/tracked-company.entity';
import type { Sentiment } from '../src/domain/sentiment';
import { RECORDED_ARTICLES, type RecordedArticle } from './fixtures/recorded-google-news-articles';

/** Friday 2026-10-09, noon in Jerusalem. */
const NOW = new Date('2026-10-09T09:00:00Z');

class MutableClock implements Clock {
  instant = NOW;
  now(): Date {
    return this.instant;
  }
}

type Verdict =
  | { readonly relevance: 'relevant'; readonly sentiment: Sentiment | null }
  | { readonly relevance: 'rejected' | 'pending' };

const { hailo, electreon, beehero } = RECORDED_ARTICLES;

/**
 * The coverage read API against the migrated Postgres. Rows are inserted
 * through TypeORM repositories from Articles recorded from Google News; the
 * verdicts are listed explicitly (to be replaced by #6's recorded verdicts).
 */
describe('Coverage read API (ApiModule against Postgres)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const clock = new MutableClock();
  const ids = { companies: [] as number[], articles: [] as number[], runs: [] as number[] };
  const company: Record<'hailo' | 'electreon' | 'beehero' | 'zutacore' | 'maolac', number> = {
    hailo: 0,
    electreon: 0,
    beehero: 0,
    zutacore: 0,
    maolac: 0,
  };

  async function insertCompany(
    displayName: string,
    status: 'active' | 'needs_review',
    coverageCapped = false,
  ): Promise<number> {
    const saved = await dataSource.getRepository(TrackedCompanyEntity).save({
      sourceName: null,
      displayName,
      aliases: displayName === 'Electreon' ? ['ElectReon Wireless'] : [],
      searchTerms: [`"${displayName}"`],
      status,
      reviewReason: status === 'needs_review' ? 'Common word' : null,
      coverageCapped,
    });
    ids.companies.push(saved.id);
    return saved.id;
  }

  async function insertCandidate(companyId: number, runId: number, article: RecordedArticle, verdict: Verdict): Promise<void> {
    const articles = dataSource.getRepository(ArticleEntity);
    const stored =
      (await articles.findOneBy({ googleArticleId: article.googleArticleId })) ?? (await articles.save({ ...article }));
    if (!ids.articles.includes(stored.id)) ids.articles.push(stored.id);
    const relevant = verdict.relevance === 'relevant';
    await dataSource.getRepository(CandidateEntity).save({
      articleId: stored.id,
      companyId,
      fetchedInRunId: runId,
      relevance: verdict.relevance,
      relevanceMethod: verdict.relevance === 'pending' ? null : 'llm',
      relevanceReason: verdict.relevance === 'pending' ? null : relevant ? 'About the company' : 'Different company',
      relevanceClassifiedAt: verdict.relevance === 'pending' ? null : new Date('2026-10-07T12:00:00Z'),
      sentiment: relevant ? verdict.sentiment : null,
      sentimentReason: relevant && verdict.sentiment !== null ? `Reads ${verdict.sentiment}` : null,
      sentimentClassifiedAt: relevant && verdict.sentiment !== null ? new Date('2026-10-07T12:00:00Z') : null,
      confirmedInRunId: relevant ? runId : null,
      confirmedAt: relevant ? new Date('2026-10-07T12:00:00Z') : null,
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiModule] })
      .overrideProvider(COVERAGE_CLOCK)
      .useValue(clock)
      .overrideProvider(COVERAGE_SETTINGS)
      .useValue({ timeZone: 'Asia/Jerusalem' })
      .compile();
    app = configureApiApp(moduleRef.createNestApplication<NestExpressApplication>());
    await app.init();
    dataSource = app.get(DataSource);

    const run = await dataSource.getRepository(RunEntity).save({
      type: 'backfill',
      status: 'completed',
      params: { until: null, companyIds: null, reprocess: false },
      trigger: 'dashboard',
      startedAt: new Date('2026-10-07T11:00:00Z'),
      finishedAt: new Date('2026-10-07T12:00:00Z'),
    });
    ids.runs.push(run.id);

    company.hailo = await insertCompany('Hailo', 'active', true);
    company.electreon = await insertCompany('Electreon', 'active');
    company.beehero = await insertCompany('BeeHero', 'active');
    company.zutacore = await insertCompany('ZutaCore', 'needs_review');
    company.maolac = await insertCompany('Maolac', 'active');

    await insertCandidate(company.hailo, run.id, hailo[6], { relevance: 'relevant', sentiment: 'positive' });
    await insertCandidate(company.hailo, run.id, hailo[2], { relevance: 'relevant', sentiment: 'positive' });
    await insertCandidate(company.hailo, run.id, hailo[0], { relevance: 'relevant', sentiment: 'neutral' });
    await insertCandidate(company.hailo, run.id, hailo[4], { relevance: 'relevant', sentiment: 'negative' });
    await insertCandidate(company.hailo, run.id, hailo[5], { relevance: 'relevant', sentiment: 'positive' });
    await insertCandidate(company.hailo, run.id, hailo[3], { relevance: 'rejected' });
    await insertCandidate(company.electreon, run.id, electreon[2], { relevance: 'relevant', sentiment: 'negative' });
    await insertCandidate(company.electreon, run.id, electreon[0], { relevance: 'relevant', sentiment: 'negative' });
    await insertCandidate(company.electreon, run.id, electreon[1], { relevance: 'relevant', sentiment: null });
    await insertCandidate(company.electreon, run.id, electreon[3], { relevance: 'pending' });
    await insertCandidate(company.beehero, run.id, beehero[2], { relevance: 'relevant', sentiment: 'neutral' });
    await insertCandidate(company.beehero, run.id, beehero[0], { relevance: 'rejected' });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(CandidateEntity).delete({ companyId: In(ids.companies) });
      await dataSource.getRepository(ArticleEntity).delete({ id: In(ids.articles) });
      await dataSource.getRepository(TrackedCompanyEntity).delete({ id: In(ids.companies) });
      await dataSource.getRepository(RunEntity).delete({ id: In(ids.runs) });
    }
    await app?.close();
  });

  beforeEach(() => {
    clock.instant = NOW;
  });

  function server(): App {
    return app.getHttpServer();
  }

  async function names(query: Record<string, string>): Promise<string[]> {
    const response = await request(server()).get('/api/companies').query(query).expect(200);
    return (response.body as { displayName: string }[]).map((row) => row.displayName);
  }

  describe('GET /api/summary', () => {
    it('summarises the rolling window, with the collection start and last refresh', async () => {
      const response = await request(server()).get('/api/summary').expect(200);

      expect(response.body).toEqual({
        window: 'rolling90',
        from: '2026-07-11T09:00:00.000Z',
        to: '2026-10-09T09:00:00.000Z',
        asOf: '2026-10-07T12:00:00.000Z',
        collectionStartedAt: '2026-07-09T11:00:00.000Z',
        companiesByMentionStatus: { active: 1, recent: 1, quiet: 1, no_coverage: 1 },
        mentionCount: 8,
        sentiment: { positive: 2, negative: 3, neutral: 2 },
        companiesWithNegativeMentions: 2,
      });
    });

    it('bounds a past quarter at midnight in the configured zone', async () => {
      const response = await request(server()).get('/api/summary').query({ window: '2026-Q3' }).expect(200);

      expect(response.body).toMatchObject({
        window: '2026-Q3',
        from: '2026-06-30T21:00:00.000Z',
        to: '2026-09-30T21:00:00.000Z',
        mentionCount: 6,
        sentiment: { positive: 0, negative: 3, neutral: 2 },
      });
    });

    it('ends the current quarter now', async () => {
      const response = await request(server()).get('/api/summary').query({ window: '2026-Q4' }).expect(200);

      expect(response.body).toMatchObject({
        from: '2026-09-30T21:00:00.000Z',
        to: '2026-10-09T09:00:00.000Z',
        mentionCount: 2,
        sentiment: { positive: 2, negative: 0, neutral: 0 },
      });
    });

    it.each(['rolling30', '2026-Q5', '2027-Q1', 'x'.repeat(40)])('answers 400 on the window %p', async (window) => {
      await request(server()).get('/api/summary').query({ window }).expect(400);
    });
  });

  describe('GET /api/companies', () => {
    it('lists active companies, negatives in the window first, then recency', async () => {
      expect(await names({})).toEqual(['Electreon', 'Hailo', 'BeeHero', 'Maolac']);
    });

    it('returns the row shape the dashboard reads', async () => {
      const response = await request(server()).get('/api/companies').query({ q: 'hailo' }).expect(200);

      expect(response.body).toEqual([
        {
          id: company.hailo,
          displayName: 'Hailo',
          mentionStatus: 'active',
          lastMentionAt: hailo[6].publishedAt.toISOString(),
          mentionCount: 4,
          capped: true,
          sentiment: { positive: 2, negative: 1, neutral: 1 },
          latestHeadline: {
            title: hailo[6].title,
            outletName: hailo[6].outletName,
            url: hailo[6].googleUrl,
            publishedAt: hailo[6].publishedAt.toISOString(),
          },
        },
      ]);
    });

    it.each([
      ['2026-10-09T09:00:00Z', 7, 'active'],
      ['2026-10-10T09:00:00Z', 8, 'recent'],
      ['2026-11-01T09:00:00Z', 30, 'recent'],
      ['2026-11-02T09:00:00Z', 31, 'quiet'],
      ['2026-12-31T09:00:00Z', 90, 'quiet'],
    ])('rates a last Mention as of %s (%i days) as %s', async (now, _days, status) => {
      clock.instant = new Date(now);

      const response = await request(server()).get('/api/companies').query({ q: 'Hailo' }).expect(200);

      expect((response.body as { mentionStatus: string }[])[0]?.mentionStatus).toBe(status);
    });

    it('filters by Mention Status, negatives and name or alias', async () => {
      expect(await names({ status: 'quiet' })).toEqual(['BeeHero']);
      expect(await names({ status: 'no_coverage' })).toEqual(['Maolac']);
      expect(await names({ hasNegatives: 'true' })).toEqual(['Electreon', 'Hailo']);
      expect(await names({ hasNegatives: 'false' })).toEqual(['BeeHero', 'Maolac']);
      expect(await names({ q: 'wireless' })).toEqual(['Electreon']);
      expect(await names({ q: '%' })).toEqual([]);
    });

    it('sorts on request', async () => {
      expect(await names({ sort: 'recency' })).toEqual(['Hailo', 'Electreon', 'BeeHero', 'Maolac']);
      expect(await names({ sort: 'name' })).toEqual(['BeeHero', 'Electreon', 'Hailo', 'Maolac']);
    });

    it('counts a quarter only inside its bounds', async () => {
      const response = await request(server()).get('/api/companies').query({ window: '2026-Q3', q: 'Hailo' }).expect(200);

      expect(response.body).toMatchObject([
        { mentionCount: 2, sentiment: { positive: 0, negative: 1, neutral: 1 }, latestHeadline: { title: hailo[0].title } },
      ]);
    });

    it.each([{ status: 'dormant' }, { hasNegatives: 'yes' }, { sort: 'random' }, { page: '1' }])(
      'answers 400 on %p',
      async (query) => {
        await request(server()).get('/api/companies').query(query).expect(400);
      },
    );
  });

  describe('GET /api/companies/:id', () => {
    it('returns the profile, Mention Status, contiguous weekly series and rejection rate', async () => {
      const response = await request(server()).get(`/api/companies/${company.hailo}`).expect(200);
      const body = response.body as { weeklySeries: { weekStart: string }[] };

      expect(response.body).toMatchObject({
        id: company.hailo,
        sourceName: null,
        status: 'active',
        profile: { displayName: 'Hailo', aliases: [], domain: null, description: null, searchTerms: ['"Hailo"'] },
        window: 'rolling90',
        mentionStatus: 'active',
        mentionCount: 4,
        capped: true,
        sentiment: { positive: 2, negative: 1, neutral: 1 },
        rejectionRate: 0.2,
      });
      expect(body.weeklySeries).toHaveLength(14);
      expect(body.weeklySeries[0]?.weekStart).toBe('2026-07-06');
      expect(body.weeklySeries).toContainEqual({ weekStart: '2026-09-28', positive: 2, negative: 0, neutral: 0 });
      expect(body.weeklySeries).toContainEqual({ weekStart: '2026-07-20', positive: 0, negative: 1, neutral: 0 });
      expect(body.weeklySeries).toContainEqual({ weekStart: '2026-09-21', positive: 0, negative: 0, neutral: 1 });
    });

    it('shows a company in Needs Review', async () => {
      const response = await request(server()).get(`/api/companies/${company.zutacore}`).expect(200);

      expect(response.body).toMatchObject({ status: 'needs_review', mentionStatus: 'no_coverage', rejectionRate: null });
    });

    it('answers 404 for an unknown company and 400 for a malformed id or window', async () => {
      await request(server()).get('/api/companies/2147483647').expect(404);
      await request(server()).get('/api/companies/abc').expect(400);
      await request(server()).get('/api/companies/0').expect(400);
      await request(server()).get('/api/companies/2147483648').expect(400);
      await request(server()).get(`/api/companies/${company.hailo}`).query({ window: '2026-q3' }).expect(400);
    });
  });

  describe('GET /api/companies/:id/candidates', () => {
    const path = (id: number): string => `/api/companies/${id}/candidates`;

    it('pages Mentions newest first, with links and verdicts', async () => {
      const first = await request(server()).get(path(company.hailo)).query({ pageSize: '3' }).expect(200);
      const second = await request(server()).get(path(company.hailo)).query({ pageSize: '3', page: '2' }).expect(200);
      const firstBody = first.body as { items: { article: { title: string } }[] };

      expect(first.body).toMatchObject({ total: 4, page: 1, pageSize: 3 });
      expect(firstBody.items.map((item) => item.article.title)).toEqual([hailo[6].title, hailo[2].title, hailo[0].title]);
      expect(firstBody.items[0]).toMatchObject({
        relevance: 'relevant',
        relevanceMethod: 'llm',
        sentiment: 'positive',
        sentimentReason: 'Reads positive',
        confirmedAt: '2026-10-07T12:00:00.000Z',
        article: {
          outletName: hailo[6].outletName,
          googleUrl: hailo[6].googleUrl,
          publisherUrl: null,
          language: 'en',
          edition: 'en-US',
          publishedAt: hailo[6].publishedAt.toISOString(),
        },
      });
      expect(second.body).toMatchObject({ total: 4, page: 2, items: [{ article: { title: hailo[4].title } }] });
    });

    it('still reports the total on a page past the end', async () => {
      const response = await request(server()).get(path(company.hailo)).query({ page: '9' }).expect(200);

      expect(response.body).toEqual({ items: [], total: 4, page: 9, pageSize: 20 });
    });

    it('lists rejected Candidates with reasons, or all of them', async () => {
      const rejected = await request(server()).get(path(company.beehero)).query({ include: 'rejected' }).expect(200);
      const all = await request(server()).get(path(company.electreon)).query({ include: 'all' }).expect(200);

      expect(rejected.body).toMatchObject({
        total: 1,
        items: [{ relevance: 'rejected', relevanceReason: 'Different company', sentiment: null }],
      });
      expect(all.body).toMatchObject({ total: 4 });
    });

    it('answers 404 for an unknown company and 400 on bad paging', async () => {
      await request(server()).get(path(2147483647)).expect(404);
      await request(server()).get(path(company.hailo)).query({ pageSize: '101' }).expect(400);
      await request(server()).get(path(company.hailo)).query({ page: '0' }).expect(400);
      await request(server()).get(path(company.hailo)).query({ include: 'pending' }).expect(400);
    });
  });
});
