import type { TrackedCompany } from '../../domain/company';
import type { DateRange } from '../../domain/date-range';
import { calendarDateIn, type CalendarDate } from '../../domain/time-zone';
import {
  CoverageCompanyNotFound,
  type CandidateSelection,
  type CandidateSlice,
  type CollectionTimeline,
  type CompanyCoverage,
  type CompanyCoverageDetail,
  type CoverageCandidate,
  type CoverageReadModel,
  type SentimentCounts,
  type WeeklyMentionCount,
} from '../coverage-read-model';

/** A stored Candidate: which company it was found for, and when it was fetched. */
export interface StoredCandidate extends CoverageCandidate {
  readonly companyId: number;
  readonly fetchedAt: Date;
}

/** The in-memory fake's contents. */
export interface CoverageStore {
  readonly companies: readonly TrackedCompany[];
  readonly candidates: readonly StoredCandidate[];
  readonly timeline?: Partial<Pick<CollectionTimeline, 'lastRefreshedAt' | 'firstBackfillStartedAt'>>;
}

const MS_PER_DAY = 86_400_000;

function inside(period: DateRange, instant: Date): boolean {
  return instant.getTime() >= period.from.getTime() && instant.getTime() < period.to.getTime();
}

function newestFirst(a: CoverageCandidate, b: CoverageCandidate): number {
  return b.article.publishedAt.getTime() - a.article.publishedAt.getTime() || b.id - a.id;
}

function countSentiments(candidates: readonly CoverageCandidate[]): SentimentCounts {
  const counts = { positive: 0, negative: 0, neutral: 0 };
  for (const candidate of candidates) if (candidate.sentiment !== null) counts[candidate.sentiment] += 1;
  return counts;
}

function mondayOf(date: CalendarDate): CalendarDate {
  const epoch = Date.UTC(date.year, date.month - 1, date.day);
  const daysSinceMonday = (new Date(epoch).getUTCDay() + 6) % 7;
  const monday = new Date(epoch - daysSinceMonday * MS_PER_DAY);
  return { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate() };
}

/** `CoverageReadModel` over plain arrays, for unit tests. */
export class InMemoryCoverageReadModel implements CoverageReadModel {
  constructor(private readonly store: CoverageStore) {}

  listActiveCompanyCoverage(period: DateRange, nameQuery: string | null): Promise<readonly CompanyCoverage[]> {
    const needle = nameQuery?.toLowerCase() ?? null;
    return Promise.resolve(
      this.store.companies
        .filter((company) => company.status === 'active')
        .filter(
          (company) =>
            needle === null ||
            [company.profile.displayName, ...company.profile.aliases].some((name) =>
              name.toLowerCase().includes(needle),
            ),
        )
        .map((company) => this.coverageOf(company, period)),
    );
  }

  getCompanyCoverage(companyId: number, period: DateRange): Promise<CompanyCoverageDetail> {
    const company = this.company(companyId);
    const verdicts = this.candidatesOf(companyId).filter((candidate) => inside(period, candidate.article.publishedAt));
    return Promise.resolve({
      ...this.coverageOf(company, period),
      company,
      relevantCandidates: verdicts.filter((candidate) => candidate.relevance === 'relevant').length,
      rejectedCandidates: verdicts.filter((candidate) => candidate.relevance === 'rejected').length,
    });
  }

  weeklyMentionCounts(companyId: number, period: DateRange, timeZone: string): Promise<readonly WeeklyMentionCount[]> {
    const byWeek = new Map<number, { weekStart: CalendarDate; mentions: CoverageCandidate[] }>();
    for (const mention of this.mentionsOf(companyId)) {
      if (mention.sentiment === null || !inside(period, mention.article.publishedAt)) continue;
      const weekStart = mondayOf(calendarDateIn(mention.article.publishedAt, timeZone));
      const key = Date.UTC(weekStart.year, weekStart.month - 1, weekStart.day);
      const week = byWeek.get(key) ?? { weekStart, mentions: [] };
      week.mentions.push(mention);
      byWeek.set(key, week);
    }
    return Promise.resolve(
      [...byWeek.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, week]) => ({ weekStart: week.weekStart, sentiment: countSentiments(week.mentions) })),
    );
  }

  listCandidates(
    companyId: number,
    period: DateRange,
    selection: CandidateSelection,
    page: { readonly offset: number; readonly limit: number },
  ): Promise<CandidateSlice> {
    this.company(companyId);
    const matching = this.candidatesOf(companyId)
      .filter((candidate) => inside(period, candidate.article.publishedAt))
      .filter(
        (candidate) =>
          selection === 'all' ||
          (selection === 'mentions' ? candidate.relevance === 'relevant' : candidate.relevance === 'rejected'),
      )
      .sort(newestFirst);
    return Promise.resolve({
      items: matching.slice(page.offset, page.offset + page.limit),
      total: matching.length,
    });
  }

  collectionTimeline(): Promise<CollectionTimeline> {
    const fetches = this.store.candidates.map((candidate) => candidate.fetchedAt.getTime());
    return Promise.resolve({
      lastRefreshedAt: this.store.timeline?.lastRefreshedAt ?? null,
      firstBackfillStartedAt: this.store.timeline?.firstBackfillStartedAt ?? null,
      firstCandidateFetchedAt: fetches.length === 0 ? null : new Date(Math.min(...fetches)),
    });
  }

  private company(companyId: number): TrackedCompany {
    const company = this.store.companies.find((candidate) => candidate.id === companyId);
    if (company === undefined) throw new CoverageCompanyNotFound(companyId);
    return company;
  }

  private candidatesOf(companyId: number): StoredCandidate[] {
    return this.store.candidates.filter((candidate) => candidate.companyId === companyId);
  }

  private mentionsOf(companyId: number): StoredCandidate[] {
    return this.candidatesOf(companyId).filter((candidate) => candidate.relevance === 'relevant');
  }

  private coverageOf(company: TrackedCompany, period: DateRange): CompanyCoverage {
    const mentions = this.mentionsOf(company.id).sort(newestFirst);
    const inPeriod = mentions.filter((mention) => inside(period, mention.article.publishedAt));
    return {
      companyId: company.id,
      displayName: company.profile.displayName,
      capped: company.coverageCapped,
      lastMentionAt: mentions[0]?.article.publishedAt ?? null,
      mentionCount: inPeriod.length,
      sentiment: countSentiments(inPeriod),
      latestMention: inPeriod[0]?.article ?? null,
    };
  }
}
