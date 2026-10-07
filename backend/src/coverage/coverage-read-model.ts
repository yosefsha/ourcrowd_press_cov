import type { CalendarDate } from '../domain/time-zone';
import type { DateRange } from '../domain/date-range';
import type { TrackedCompany } from '../domain/company';
import type { Relevance, RelevanceMethod } from '../domain/relevance';
import type { Sentiment } from '../domain/sentiment';

/** Injection token for the `CoverageReadModel` port. */
export const COVERAGE_READ_MODEL = Symbol('COVERAGE_READ_MODEL');

/** Mention counts per Sentiment. */
export type SentimentCounts = Readonly<Record<Sentiment, number>>;

/** An Article as the dashboard shows it. */
export interface CoverageArticle {
  readonly id: number;
  readonly title: string;
  readonly snippet: string;
  readonly outletName: string;
  readonly outletUrl: string;
  readonly googleUrl: string;
  readonly publisherUrl: string | null;
  readonly publishedAt: Date;
  readonly language: string;
  readonly edition: string;
}

/** One Tracked Company's coverage: its latest Mention ever, and its Mentions inside a period. */
export interface CompanyCoverage {
  readonly companyId: number;
  readonly displayName: string;
  readonly capped: boolean;
  /** Publication time of the company's most recent Mention ever; null when it has none. */
  readonly lastMentionAt: Date | null;
  /** Mentions published inside the period, whether or not their Sentiment is judged yet. */
  readonly mentionCount: number;
  /** Mentions inside the period per judged Sentiment. */
  readonly sentiment: SentimentCounts;
  /** The most recently published Mention inside the period. */
  readonly latestMention: CoverageArticle | null;
}

/** A Tracked Company's coverage with its profile and the Relevance Verdicts inside the period. */
export interface CompanyCoverageDetail extends CompanyCoverage {
  readonly company: TrackedCompany;
  /** Candidates published inside the period judged relevant (Mentions). */
  readonly relevantCandidates: number;
  /** Candidates published inside the period judged not about the company. */
  readonly rejectedCandidates: number;
}

/** Mentions per Sentiment published in the week (Monday to Sunday, in the given zone) starting on `weekStart`. */
export interface WeeklyMentionCount {
  readonly weekStart: CalendarDate;
  readonly sentiment: SentimentCounts;
}

/** Which Candidates a listing returns. */
export const CANDIDATE_SELECTIONS = ['mentions', 'rejected', 'all'] as const;
export type CandidateSelection = (typeof CANDIDATE_SELECTIONS)[number];

/** A Candidate with its Article, Relevance Verdict and (for Mentions) Sentiment. */
export interface CoverageCandidate {
  readonly id: number;
  readonly article: CoverageArticle;
  readonly relevance: Relevance;
  readonly relevanceMethod: RelevanceMethod | null;
  readonly relevanceReason: string | null;
  readonly sentiment: Sentiment | null;
  readonly sentimentReason: string | null;
  readonly confirmedAt: Date | null;
}

export interface CandidateSlice {
  readonly items: readonly CoverageCandidate[];
  /** Matching Candidates across all pages. */
  readonly total: number;
}

/** The facts that date the collected data. */
export interface CollectionTimeline {
  /** When the most recent Run that completed (with or without errors) finished. */
  readonly lastRefreshedAt: Date | null;
  /** When the first Candidate still stored was fetched. */
  readonly firstCandidateFetchedAt: Date | null;
  /** When the first Backfill started. */
  readonly firstBackfillStartedAt: Date | null;
}

/**
 * The dashboard's read model over Tracked Companies, Candidates, Mentions and
 * Runs. Periods are half-open (`from` inclusive, `to` exclusive) on an
 * Article's publication time. Fails with `CoverageDataUnavailable` when the
 * store cannot be read.
 */
export interface CoverageReadModel {
  /**
   * Coverage of every active Tracked Company, in no particular order.
   * `nameQuery`, when given, keeps companies whose display name or an alias
   * contains it, case-insensitively.
   */
  listActiveCompanyCoverage(period: DateRange, nameQuery: string | null): Promise<readonly CompanyCoverage[]>;
  /** Coverage of one Tracked Company in any status. Throws `CoverageCompanyNotFound`. */
  getCompanyCoverage(companyId: number, period: DateRange): Promise<CompanyCoverageDetail>;
  /**
   * Mentions with a judged Sentiment per week inside the period, weeks
   * starting on Monday in `timeZone`. Weeks without such Mentions are left out.
   */
  weeklyMentionCounts(
    companyId: number,
    period: DateRange,
    timeZone: string,
  ): Promise<readonly WeeklyMentionCount[]>;
  /**
   * One page of a company's Candidates published inside the period, newest
   * first. Throws `CoverageCompanyNotFound`.
   */
  listCandidates(
    companyId: number,
    period: DateRange,
    selection: CandidateSelection,
    page: { readonly offset: number; readonly limit: number },
  ): Promise<CandidateSlice>;
  collectionTimeline(): Promise<CollectionTimeline>;
}

export class CoverageCompanyNotFound extends Error {
  constructor(readonly companyId: number) {
    super(`Tracked Company ${companyId} does not exist`);
    this.name = 'CoverageCompanyNotFound';
  }
}

/** The coverage store could not be read. */
export class CoverageDataUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoverageDataUnavailable';
  }
}
