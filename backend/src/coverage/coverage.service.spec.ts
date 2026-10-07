import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { RECORDED_ARTICLES, type RecordedArticle } from '../../test/fixtures/recorded-google-news-articles';
import type { TrackedCompany, TrackedCompanyStatus } from '../domain/company';
import type { Sentiment } from '../domain/sentiment';
import { CoverageDataUnavailable, type CoverageReadModel } from './coverage-read-model';
import type { Clock } from './coverage-settings';
import { CoverageService, collectionStartedAt } from './coverage.service';
import { CandidatesQueryDto } from './dto/candidates-query.dto';
import { CompaniesQueryDto } from './dto/companies-query.dto';
import { InMemoryCoverageReadModel, type StoredCandidate } from './repositories/in-memory-coverage-read-model';

const TIME_ZONE = 'Asia/Jerusalem';
/** Friday 2026-10-09, noon in Jerusalem. */
const NOW = new Date('2026-10-09T09:00:00Z');
const FETCHED_AT = new Date('2026-10-07T11:30:00Z');

function company(id: number, displayName: string, status: TrackedCompanyStatus = 'active', capped = false): TrackedCompany {
  return {
    id,
    sourceName: displayName === 'Hailo' || displayName === 'ZutaCore' ? displayName : null,
    status,
    reviewReason: status === 'needs_review' ? 'Common word' : null,
    coverageCapped: capped,
    profile: { displayName, aliases: [], domain: null, description: null, searchTerms: [`"${displayName}"`] },
    createdAt: FETCHED_AT,
    updatedAt: FETCHED_AT,
  };
}

let nextId = 1;

/**
 * A Candidate for a recorded Article. Verdicts are listed explicitly here; they
 * should be replaced by #6's recorded classifier verdicts once those exist.
 */
function candidate(
  companyId: number,
  article: RecordedArticle,
  verdict: { relevance: 'relevant'; sentiment: Sentiment | null } | { relevance: 'rejected' | 'pending' },
): StoredCandidate {
  const id = nextId++;
  const relevant = verdict.relevance === 'relevant';
  return {
    id,
    companyId,
    fetchedAt: FETCHED_AT,
    article: { id: 1000 + id, ...article },
    relevance: verdict.relevance,
    relevanceMethod: verdict.relevance === 'pending' ? null : 'llm',
    relevanceReason: verdict.relevance === 'pending' ? null : relevant ? 'About the company' : 'Different company',
    sentiment: relevant ? verdict.sentiment : null,
    sentimentReason: relevant && verdict.sentiment !== null ? `Reads ${verdict.sentiment}` : null,
    confirmedAt: relevant ? FETCHED_AT : null,
  };
}

const HAILO = 1;
const ELECTREON = 2;
const BEEHERO = 3;
const ZUTACORE = 4;
const MAOLAC = 5;

const { hailo, electreon, beehero } = RECORDED_ARTICLES;

function buildStore(): ConstructorParameters<typeof InMemoryCoverageReadModel>[0] {
  nextId = 1;
  return {
    companies: [
      company(HAILO, 'Hailo', 'active', true),
      company(ELECTREON, 'Electreon'),
      company(BEEHERO, 'BeeHero'),
      company(ZUTACORE, 'ZutaCore', 'needs_review'),
      company(MAOLAC, 'Maolac'),
    ],
    candidates: [
      // Hailo: latest Mention 2026-10-02 (7 days before NOW) → Active.
      candidate(HAILO, hailo[6], { relevance: 'relevant', sentiment: 'positive' }),
      candidate(HAILO, hailo[2], { relevance: 'relevant', sentiment: 'positive' }),
      candidate(HAILO, hailo[0], { relevance: 'relevant', sentiment: 'neutral' }),
      candidate(HAILO, hailo[4], { relevance: 'relevant', sentiment: 'negative' }),
      candidate(HAILO, hailo[5], { relevance: 'relevant', sentiment: 'positive' }), // before rolling90
      candidate(HAILO, hailo[3], { relevance: 'rejected' }),
      // Electreon: latest Mention 2026-09-15 (24 days) → Recent; two negatives.
      candidate(ELECTREON, electreon[2], { relevance: 'relevant', sentiment: 'negative' }),
      candidate(ELECTREON, electreon[0], { relevance: 'relevant', sentiment: 'negative' }),
      candidate(ELECTREON, electreon[1], { relevance: 'relevant', sentiment: null }),
      candidate(ELECTREON, electreon[3], { relevance: 'pending' }),
      // BeeHero: latest Mention 2026-09-08 (31 days) → Quiet.
      candidate(BEEHERO, beehero[2], { relevance: 'relevant', sentiment: 'neutral' }),
      candidate(BEEHERO, beehero[0], { relevance: 'rejected' }),
    ],
    timeline: {
      lastRefreshedAt: new Date('2026-10-08T05:12:00Z'),
      firstBackfillStartedAt: new Date('2026-10-07T11:00:00Z'),
    },
  };
}

class FixedClock implements Clock {
  constructor(private instant: Date) {}
  now(): Date {
    return this.instant;
  }
  set(instant: Date): void {
    this.instant = instant;
  }
}

function query<T extends object>(Dto: new () => T, fields: Partial<T>): T {
  return Object.assign(new Dto(), fields);
}

describe('CoverageService', () => {
  let clock: FixedClock;
  let service: CoverageService;

  beforeEach(() => {
    clock = new FixedClock(NOW);
    service = new CoverageService(new InMemoryCoverageReadModel(buildStore()), clock, { timeZone: TIME_ZONE });
  });

  describe('summary', () => {
    it('counts active companies per Mention Status and Mentions in the rolling window', async () => {
      const summary = await service.summary('rolling90');

      expect(summary).toEqual({
        window: 'rolling90',
        from: '2026-07-11T09:00:00.000Z',
        to: NOW.toISOString(),
        asOf: '2026-10-08T05:12:00.000Z',
        collectionStartedAt: '2026-07-09T11:00:00.000Z',
        companiesByMentionStatus: { active: 1, recent: 1, quiet: 1, no_coverage: 1 },
        mentionCount: 8,
        sentiment: { positive: 2, negative: 3, neutral: 2 },
        companiesWithNegativeMentions: 2,
      });
    });

    it('limits Mentions to a past quarter, ending at its last day', async () => {
      const summary = await service.summary('2026-Q3');

      expect(summary.from).toBe('2026-06-30T21:00:00.000Z');
      expect(summary.to).toBe('2026-09-30T21:00:00.000Z');
      // Hailo's Oct 1 and Oct 2 Mentions fall in Q4; its Jun 25 one in Q2.
      expect(summary.mentionCount).toBe(6);
      expect(summary.sentiment).toEqual({ positive: 0, negative: 3, neutral: 2 });
    });

    it('rejects a malformed or future window with a 400', async () => {
      await expect(service.summary('last-quarter')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.summary('2027-Q1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reports no collection start and no refresh before anything was collected', async () => {
      const empty = new CoverageService(
        new InMemoryCoverageReadModel({ companies: [company(MAOLAC, 'Maolac')], candidates: [] }),
        clock,
        { timeZone: TIME_ZONE },
      );

      const summary = await empty.summary('rolling90');

      expect(summary.asOf).toBeNull();
      expect(summary.collectionStartedAt).toBeNull();
      expect(summary.companiesByMentionStatus).toEqual({ active: 0, recent: 0, quiet: 0, no_coverage: 1 });
    });

    it('answers 503 when the read model is unavailable', async () => {
      const down = (): Promise<never> => Promise.reject(new CoverageDataUnavailable('down'));
      const failing: CoverageReadModel = {
        listActiveCompanyCoverage: down,
        getCompanyCoverage: down,
        weeklyMentionCounts: down,
        listCandidates: down,
        collectionTimeline: down,
      };

      await expect(
        new CoverageService(failing, clock, { timeZone: TIME_ZONE }).summary('rolling90'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('collectionStartedAt', () => {
    it('is the first Backfill window start when that is earlier than the first fetch', () => {
      expect(
        collectionStartedAt({
          lastRefreshedAt: null,
          firstBackfillStartedAt: new Date('2026-10-01T00:00:00Z'),
          firstCandidateFetchedAt: new Date('2026-10-01T00:05:00Z'),
        }),
      ).toEqual(new Date('2026-07-03T00:00:00Z'));
    });

    it('is the first fetch when no Backfill ever started', () => {
      expect(
        collectionStartedAt({
          lastRefreshedAt: null,
          firstBackfillStartedAt: null,
          firstCandidateFetchedAt: FETCHED_AT,
        }),
      ).toEqual(FETCHED_AT);
    });
  });

  describe('listCompanies', () => {
    it('sorts by negatives in the window, then recency, by default', async () => {
      const rows = await service.listCompanies(query(CompaniesQueryDto, {}));

      expect(rows.map((row) => row.displayName)).toEqual(['Electreon', 'Hailo', 'BeeHero', 'Maolac']);
    });

    it('describes a row with its status, counts, cap and latest headline in the window', async () => {
      const [hailoRow] = await service.listCompanies(query(CompaniesQueryDto, { q: 'hai' }));

      expect(hailoRow).toEqual({
        id: HAILO,
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
      });
    });

    it('never lists companies that are not active', async () => {
      const rows = await service.listCompanies(query(CompaniesQueryDto, { status: 'no_coverage' }));

      expect(rows.map((row) => row.displayName)).toEqual(['Maolac']);
    });

    it('filters by Mention Status and by negatives', async () => {
      const quiet = await service.listCompanies(query(CompaniesQueryDto, { status: 'quiet' }));
      const negatives = await service.listCompanies(query(CompaniesQueryDto, { hasNegatives: true }));
      const none = await service.listCompanies(query(CompaniesQueryDto, { hasNegatives: false }));

      expect(quiet.map((row) => row.displayName)).toEqual(['BeeHero']);
      expect(negatives.map((row) => row.displayName)).toEqual(['Electreon', 'Hailo']);
      expect(none.map((row) => row.displayName)).toEqual(['BeeHero', 'Maolac']);
    });

    it('sorts by recency, Mention count or name on request', async () => {
      const names = async (sort: CompaniesQueryDto['sort']): Promise<string[]> =>
        (await service.listCompanies(query(CompaniesQueryDto, { sort }))).map((row) => row.displayName);

      expect(await names('recency')).toEqual(['Hailo', 'Electreon', 'BeeHero', 'Maolac']);
      expect(await names('mentions')).toEqual(['Hailo', 'Electreon', 'BeeHero', 'Maolac']);
      expect(await names('name')).toEqual(['BeeHero', 'Electreon', 'Hailo', 'Maolac']);
    });

    it.each([
      ['2026-10-09T09:00:00Z', 'active'],
      ['2026-10-10T09:00:00Z', 'recent'],
      ['2026-11-01T09:00:00Z', 'recent'],
      ['2026-11-02T09:00:00Z', 'quiet'],
      ['2026-12-31T09:00:00Z', 'quiet'],
    ] as const)('rates Hailo (last Mention Oct 2) at %s as %s', async (now, status) => {
      clock.set(new Date(now));

      const [row] = await service.listCompanies(query(CompaniesQueryDto, { q: 'Hailo' }));

      expect(row?.mentionStatus).toBe(status);
    });
  });

  describe('getCompany', () => {
    it('returns the profile, contiguous weekly series and rejection rate', async () => {
      const detail = await service.getCompany(HAILO, 'rolling90');

      expect(detail).toMatchObject({
        id: HAILO,
        sourceName: 'Hailo',
        status: 'active',
        window: 'rolling90',
        mentionStatus: 'active',
        mentionCount: 4,
        capped: true,
        rejectionRate: 1 / 5,
      });
      const weeks = detail.weeklySeries.map((point) => point.weekStart);
      expect(weeks[0]).toBe('2026-07-06');
      expect(weeks[weeks.length - 1]).toBe('2026-10-05');
      expect(weeks).toHaveLength(14);
      for (let index = 1; index < weeks.length; index += 1) {
        const gap = Date.parse(weeks[index] ?? '') - Date.parse(weeks[index - 1] ?? '');
        expect(gap).toBe(7 * 86_400_000);
      }
      expect(detail.weeklySeries.find((point) => point.weekStart === '2026-09-28')).toEqual({
        weekStart: '2026-09-28',
        positive: 2,
        negative: 0,
        neutral: 0,
      });
      expect(detail.weeklySeries.find((point) => point.weekStart === '2026-07-20')).toEqual({
        weekStart: '2026-07-20',
        positive: 0,
        negative: 1,
        neutral: 0,
      });
    });

    it('shows a company in Needs Review, with no rejection rate when nothing was classified', async () => {
      const detail = await service.getCompany(ZUTACORE, 'rolling90');

      expect(detail).toMatchObject({ status: 'needs_review', mentionStatus: 'no_coverage', rejectionRate: null });
      expect(detail.weeklySeries.every((point) => point.positive + point.negative + point.neutral === 0)).toBe(true);
    });

    it('answers 404 for an unknown company', async () => {
      await expect(service.getCompany(999, 'rolling90')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listCandidates', () => {
    it('pages Mentions newest first', async () => {
      const first = await service.listCandidates(HAILO, query(CandidatesQueryDto, { pageSize: 3 }));
      const second = await service.listCandidates(HAILO, query(CandidatesQueryDto, { pageSize: 3, page: 2 }));

      expect(first.total).toBe(4);
      expect(first.items.map((item) => item.article.title)).toEqual([hailo[6].title, hailo[2].title, hailo[0].title]);
      expect(second).toMatchObject({ page: 2, pageSize: 3, total: 4 });
      expect(second.items.map((item) => item.article.title)).toEqual([hailo[4].title]);
    });

    it('lists rejected Candidates with their reasons, or every Candidate', async () => {
      const rejected = await service.listCandidates(HAILO, query(CandidatesQueryDto, { include: 'rejected' }));
      const all = await service.listCandidates(ELECTREON, query(CandidatesQueryDto, { include: 'all' }));

      expect(rejected.items).toEqual([
        expect.objectContaining({ relevance: 'rejected', relevanceReason: 'Different company', sentiment: null }),
      ]);
      expect(all.total).toBe(4);
      expect(all.items.map((item) => item.relevance)).toContain('pending');
    });

    it('answers 404 for an unknown company and 400 for a bad window', async () => {
      await expect(service.listCandidates(999, query(CandidatesQueryDto, {}))).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.listCandidates(HAILO, query(CandidatesQueryDto, { window: 'rolling30' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
