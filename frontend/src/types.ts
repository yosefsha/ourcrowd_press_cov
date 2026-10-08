/**
 * TypeScript mirror of the HTTP API contract in docs/IMPLEMENTATION_PLAN.md.
 *
 * Vocabulary follows CONTEXT.md. Timestamps travel as ISO-8601 strings and
 * calendar dates as `YYYY-MM-DD`; they are aliased so a field's intent is
 * visible at the use site. Every shape is read-only: the client never mutates
 * a server response in place.
 */

/** ISO-8601 timestamp with offset, e.g. `2026-10-07T07:00:00.000Z`. */
export type IsoDateTime = string;
/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

// ---------------------------------------------------------------------------
// Domain value types
// ---------------------------------------------------------------------------

export type QuarterNumber = 1 | 2 | 3 | 4;

/** A calendar quarter as the API spells it, e.g. `2026-Q3`. */
export type QuarterKey = `${number}-Q${QuarterNumber}`;

/**
 * The period of Mentions the dashboard shows: the rolling last 90 days
 * (default) or a calendar quarter. The current quarter means "to date".
 */
export type CoverageWindow = 'rolling90' | QuarterKey;

/** Whether a Mention is positive, negative or neutral toward the Tracked Company. */
export const SENTIMENTS = ['positive', 'negative', 'neutral'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

/** How recently a Tracked Company was last mentioned, regardless of the Coverage Window. */
export const MENTION_STATUSES = ['active', 'recent', 'quiet', 'no_coverage'] as const;
export type MentionStatus = (typeof MENTION_STATUSES)[number];

/** Lifecycle of a Tracked Company. `needs_review` blocks collection until a person reviews it. */
export const TRACKED_COMPANY_STATUSES = ['active', 'needs_review', 'deactivated'] as const;
export type TrackedCompanyStatus = (typeof TRACKED_COMPANY_STATUSES)[number];

/** Outcome of the Relevance Verdict for a Candidate. A Mention is a `relevant` Candidate. */
export type Relevance = 'pending' | 'relevant' | 'rejected';

/** How the Relevance Verdict was reached. */
export type RelevanceMethod = 'llm' | 'name_absent';

/** Mention counts per Sentiment. */
export type SentimentSplit = Readonly<Record<Sentiment, number>>;

/** Tracked Company counts per Mention Status. */
export type MentionStatusCounts = Readonly<Record<MentionStatus, number>>;

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

/** A single published news item at one Outlet. */
export interface Article {
  readonly id: number;
  readonly title: string;
  readonly snippet: string;
  readonly outletName: string;
  readonly outletUrl: string;
  readonly googleUrl: string;
  /** The Outlet's own URL once resolved; null while only the Google News link is known. */
  readonly publisherUrl: string | null;
  readonly publishedAt: IsoDateTime;
  readonly language: string;
  /** The News Edition it was found in, e.g. `en-US`. */
  readonly edition: string;
}

/** The headline shown on an overview row: the most recent Mention in the window. */
export interface HeadlineRef {
  readonly title: string;
  readonly outletName: string;
  readonly url: string;
  readonly publishedAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// GET /api/summary?window=
// ---------------------------------------------------------------------------

export interface SummaryQuery {
  readonly window: CoverageWindow;
}

/** Summary strip for one Coverage Window. */
export interface CoverageSummary {
  readonly window: CoverageWindow;
  /** Inclusive start and exclusive end of the resolved window. */
  readonly from: IsoDateTime;
  readonly to: IsoDateTime;
  /** When the data was last refreshed by a finished Run; null before the first one. */
  readonly asOf: IsoDateTime | null;
  /**
   * The earliest moment collection covers — the first Backfill's window start,
   * or the first Candidate fetch if earlier; null before any collection. The
   * date a company with no coverage has had nothing found since.
   */
  readonly collectionStartedAt: IsoDateTime | null;
  /** Active Tracked Companies per Mention Status (as of now, independent of the window). */
  readonly companiesByMentionStatus: MentionStatusCounts;
  /** Mentions published inside the window. */
  readonly mentionCount: number;
  readonly sentiment: SentimentSplit;
  /** Tracked Companies with at least one negative Mention inside the window. */
  readonly companiesWithNegativeMentions: number;
}

// ---------------------------------------------------------------------------
// GET /api/companies?window=&status=&hasNegatives=&q=&sort=
// ---------------------------------------------------------------------------

/**
 * Overview sort order. `negatives` (the default) sorts by negative Mentions in
 * the window descending, then by recency.
 */
export const COMPANY_SORTS = ['negatives', 'recency', 'mentions', 'name'] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

export interface CompaniesQuery {
  readonly window: CoverageWindow;
  readonly status?: MentionStatus;
  readonly hasNegatives?: boolean;
  readonly q?: string;
  readonly sort?: CompanySort;
}

/** One row of the overview table. */
export interface CompanyOverviewRow {
  readonly id: number;
  readonly displayName: string;
  readonly mentionStatus: MentionStatus;
  readonly lastMentionAt: IsoDateTime | null;
  /** Mentions inside the window. */
  readonly mentionCount: number;
  /** The last collection hit the News Source's result cap, so coverage may be incomplete. */
  readonly capped: boolean;
  readonly sentiment: SentimentSplit;
  readonly latestHeadline: HeadlineRef | null;
}

// ---------------------------------------------------------------------------
// GET /api/companies/:id?window=
// ---------------------------------------------------------------------------

export interface CompanyDetailQuery {
  readonly window: CoverageWindow;
}

/** The editable context that identifies a Tracked Company in the press. */
export interface CompanyProfile {
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly domain: string | null;
  readonly description: string | null;
  readonly searchTerms: readonly string[];
}

/** Mentions per Sentiment for the week starting on `weekStart`. */
export interface WeeklySentimentPoint {
  readonly weekStart: IsoDate;
  readonly positive: number;
  readonly negative: number;
  readonly neutral: number;
}

export interface CompanyDetail {
  readonly id: number;
  /** The exact Seed List line; null for companies added by hand. */
  readonly sourceName: string | null;
  readonly status: TrackedCompanyStatus;
  readonly profile: CompanyProfile;
  readonly window: CoverageWindow;
  readonly mentionStatus: MentionStatus;
  readonly lastMentionAt: IsoDateTime | null;
  readonly mentionCount: number;
  readonly capped: boolean;
  readonly sentiment: SentimentSplit;
  readonly weeklySeries: readonly WeeklySentimentPoint[];
  /** Share of classified Candidates in the window that were rejected, 0–1; null with no Candidates. */
  readonly rejectionRate: number | null;
}

// ---------------------------------------------------------------------------
// GET /api/companies/:id/candidates?window=&include=&page=&pageSize=
// ---------------------------------------------------------------------------

export const CANDIDATE_INCLUDES = ['mentions', 'rejected', 'all'] as const;
export type CandidateInclude = (typeof CANDIDATE_INCLUDES)[number];

export interface CandidatesQuery {
  readonly window: CoverageWindow;
  readonly include?: CandidateInclude;
  /** 1-based page number. */
  readonly page?: number;
  readonly pageSize?: number;
}

/** An Article returned for a Tracked Company, with its Relevance Verdict and (for Mentions) Sentiment. */
export interface Candidate {
  readonly id: number;
  readonly article: Article;
  readonly relevance: Relevance;
  readonly relevanceMethod: RelevanceMethod | null;
  readonly relevanceReason: string | null;
  /** Set only for Mentions (`relevance === 'relevant'`). */
  readonly sentiment: Sentiment | null;
  readonly sentimentReason: string | null;
  /** When the Candidate was confirmed as a Mention. */
  readonly confirmedAt: IsoDateTime | null;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
}

// ---------------------------------------------------------------------------
// /api/admin/companies
// ---------------------------------------------------------------------------

export interface AdminCompaniesQuery {
  readonly status?: TrackedCompanyStatus;
  readonly q?: string;
}

/** A Tracked Company as the management page sees it, including Needs Review and deactivated ones. */
export interface AdminCompany extends CompanyProfile {
  readonly id: number;
  readonly sourceName: string | null;
  readonly status: TrackedCompanyStatus;
  /** Why the company was judged possibly ambiguous; set while `needs_review`. */
  readonly reviewReason: string | null;
  readonly coverageCapped: boolean;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/** POST /api/admin/companies — add a company by hand (it has no Source Name). */
export interface CreateCompanyRequest {
  readonly displayName: string;
  readonly aliases?: readonly string[];
  readonly domain?: string | null;
  readonly description?: string | null;
  readonly searchTerms?: readonly string[];
}

/**
 * PATCH /api/admin/companies/:id — edit any Company Profile field.
 * `sourceName` never changes; the API answers 400 if it is sent, so the type forbids it.
 * Status changes go through the dedicated review / needs-review / deactivate endpoints.
 */
export interface UpdateCompanyRequest {
  readonly displayName?: string;
  readonly aliases?: readonly string[];
  readonly domain?: string | null;
  readonly description?: string | null;
  readonly searchTerms?: readonly string[];
  readonly sourceName?: never;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export const RUN_TYPES = ['backfill', 'daily_check'] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'interrupted',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export type RunTrigger = 'dashboard' | 'schedule';

export interface RunParams {
  /** Backfill cutoff date; null means up to today. */
  readonly until: IsoDate | null;
  /** Restricts the Run to these Tracked Companies; null means all active ones. */
  readonly companyIds: readonly number[] | null;
  /** Discard and re-collect existing Candidates and Mentions first (Re-process). */
  readonly reprocess: boolean;
}

/** Live progress the collector writes to the Run while it executes. */
export interface RunProgress {
  readonly companiesTotal: number;
  readonly companiesDone: number;
  readonly candidatesFound: number;
  readonly candidatesClassified: number;
  readonly mentionsConfirmed: number;
  readonly companyErrors: number;
  /** Display name of the Tracked Company being processed, if any. */
  readonly currentCompany: string | null;
}

/** One execution of a Backfill or a Daily Check. */
export interface Run {
  readonly id: number;
  readonly type: RunType;
  readonly status: RunStatus;
  readonly trigger: RunTrigger;
  readonly params: RunParams;
  /** Null until the collector claims the Run. */
  readonly progress: RunProgress | null;
  readonly error: string | null;
  readonly createdAt: IsoDateTime;
  readonly startedAt: IsoDateTime | null;
  readonly finishedAt: IsoDateTime | null;
}

export interface RunsQuery {
  readonly limit?: number;
}

/** POST /api/runs */
export interface EnqueueRunRequest {
  readonly type: RunType;
  readonly until?: IsoDate;
  readonly companyIds?: readonly number[];
}

/** Body of the 409 answered while another Run is queued or running. */
export interface RunConflictBody {
  readonly message: string;
  readonly activeRun: Run;
}

// ---------------------------------------------------------------------------
// GET /api/collector/health
// ---------------------------------------------------------------------------

export type CollectorState = 'idle' | 'importing' | 'running';

export interface CollectorHealth {
  /** The collector's heartbeat is recent enough to count it as running. */
  readonly online: boolean;
  /** Null when the collector has never reported. */
  readonly lastSeenAt: IsoDateTime | null;
  readonly state: CollectorState | null;
  readonly ollamaOk: boolean | null;
  readonly ollamaModel: string | null;
  readonly detail: string | null;
}

// ---------------------------------------------------------------------------
// Alert Digests
// ---------------------------------------------------------------------------

export interface AlertsQuery {
  readonly acknowledged?: boolean;
}

/** An Alert Digest as listed for the alert bell. */
export interface AlertDigestSummary {
  readonly id: number;
  readonly runId: number;
  readonly createdAt: IsoDateTime;
  readonly acknowledgedAt: IsoDateTime | null;
  readonly mentionCount: number;
  readonly companyCount: number;
  readonly negativeMentionCount: number;
}

/** A New Mention inside an Alert Digest. */
export interface AlertMention {
  readonly candidateId: number;
  readonly sentiment: Sentiment;
  readonly article: Article;
}

/** New Mentions for one Tracked Company, negative Mentions first. */
export interface AlertDigestCompanyGroup {
  readonly companyId: number;
  readonly displayName: string;
  readonly mentions: readonly AlertMention[];
}

/** The full summary of all New Mentions found by one Daily Check. */
export interface AlertDigest extends AlertDigestSummary {
  /** Grouped by Tracked Company; groups with negative Mentions come first. */
  readonly companies: readonly AlertDigestCompanyGroup[];
}
