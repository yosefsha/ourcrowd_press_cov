import type { TrackedCompanyStatus } from '../domain/company';
import type { Relevance, RelevanceMethod } from '../domain/relevance';
import type { RunParams, RunProgress, RunStatus, RunTrigger, RunType } from '../domain/run';
import type { Sentiment } from '../domain/sentiment';

/**
 * Version of the `data/` export format (ADR-005). Bump it whenever a record
 * shape below changes; `import-data` refuses any version it does not know.
 */
export const EXPORT_SCHEMA_VERSION = 1;

/** The files of one export. The manifest is written last, so it marks a complete export. */
export const EXPORT_FILE_NAMES = {
  manifest: 'manifest.json',
  companies: 'companies.json',
  articles: 'articles.json',
  candidates: 'candidates.json',
  runs: 'runs.json',
  alertDigests: 'alert-digests.json',
  mentionStatus: 'mention-status.json',
  mentionsCsv: 'mentions.csv',
} as const;

export type ExportFileName = (typeof EXPORT_FILE_NAMES)[keyof typeof EXPORT_FILE_NAMES];

/**
 * An instant as Postgres stores it, in UTC with microsecond precision
 * (`2026-06-02T07:00:00.000000Z`). Kept as text rather than a `Date`, which
 * would drop the microseconds and make the export lossy.
 */
export type ExportTimestamp = string;

export interface CompanyProfileRecord {
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly domain: string | null;
  readonly description: string | null;
  readonly searchTerms: readonly string[];
}

/** One Tracked Company (`companies.json`). */
export interface CompanyRecord {
  readonly id: number;
  readonly sourceName: string | null;
  readonly status: TrackedCompanyStatus;
  readonly reviewReason: string | null;
  readonly coverageCapped: boolean;
  readonly profile: CompanyProfileRecord;
  readonly createdAt: ExportTimestamp;
  readonly updatedAt: ExportTimestamp;
}

/** One Article (`articles.json`). */
export interface ArticleRecord {
  readonly id: number;
  readonly googleArticleId: string;
  readonly title: string;
  readonly snippet: string;
  readonly outletName: string;
  readonly outletUrl: string;
  readonly googleUrl: string;
  readonly publisherUrl: string | null;
  readonly publishedAt: ExportTimestamp;
  readonly language: string;
  readonly edition: string;
  readonly firstFetchedAt: ExportTimestamp;
}

/** One Candidate with its Relevance Verdict and, for a Mention, its Sentiment (`candidates.json`). */
export interface CandidateRecord {
  readonly id: number;
  readonly articleId: number;
  readonly companyId: number;
  readonly fetchedInRunId: number;
  readonly relevance: Relevance;
  readonly relevanceMethod: RelevanceMethod | null;
  readonly relevanceReason: string | null;
  readonly relevanceClassifiedAt: ExportTimestamp | null;
  readonly sentiment: Sentiment | null;
  readonly sentimentReason: string | null;
  readonly sentimentClassifiedAt: ExportTimestamp | null;
  readonly confirmedInRunId: number | null;
  readonly confirmedAt: ExportTimestamp | null;
  readonly createdAt: ExportTimestamp;
}

/** One company's failure inside a Run. */
export interface RunCompanyErrorRecord {
  readonly id: number;
  readonly companyId: number;
  /** Text, as in the schema, so a new pipeline stage needs no format change. */
  readonly stage: string;
  readonly message: string;
  readonly createdAt: ExportTimestamp;
}

/** One Run with its per-company errors (`runs.json`). */
export interface RunRecord {
  readonly id: number;
  readonly type: RunType;
  readonly status: RunStatus;
  readonly trigger: RunTrigger;
  readonly params: RunParams;
  readonly progress: RunProgress | null;
  readonly error: string | null;
  readonly createdAt: ExportTimestamp;
  readonly startedAt: ExportTimestamp | null;
  readonly finishedAt: ExportTimestamp | null;
  readonly companyErrors: readonly RunCompanyErrorRecord[];
}

/** One Alert Digest, its acknowledgement and the Candidates it lists (`alert-digests.json`). */
export interface AlertDigestRecord {
  readonly id: number;
  readonly runId: number;
  readonly createdAt: ExportTimestamp;
  readonly acknowledgedAt: ExportTimestamp | null;
  readonly candidateIds: readonly number[];
}

/**
 * Everything the dashboard and alerting need, as stored in Postgres. Every list
 * is ordered by id (digest candidate ids ascending), so an export is
 * deterministic. The collector heartbeat is live process state, not data, and
 * is not part of a snapshot.
 */
export interface Snapshot {
  readonly companies: readonly CompanyRecord[];
  readonly articles: readonly ArticleRecord[];
  readonly candidates: readonly CandidateRecord[];
  readonly runs: readonly RunRecord[];
  readonly alertDigests: readonly AlertDigestRecord[];
}

/** Row counts recorded in the manifest; `import-data` checks them against the files. */
export interface SnapshotCounts {
  readonly companies: number;
  readonly articles: number;
  readonly candidates: number;
  readonly mentions: number;
  readonly runs: number;
  readonly runCompanyErrors: number;
  readonly alertDigests: number;
  readonly alertDigestItems: number;
}

/** `manifest.json`. */
export interface ExportManifest {
  readonly schemaVersion: number;
  readonly exportedAt: string;
  /** The zone `mention-status.json` and `mentions.csv` count calendar days in. */
  readonly timeZone: string;
  readonly counts: SnapshotCounts;
}

/** The counts of a snapshot, as the manifest records them. */
export function countSnapshot(snapshot: Snapshot): SnapshotCounts {
  return {
    companies: snapshot.companies.length,
    articles: snapshot.articles.length,
    candidates: snapshot.candidates.length,
    mentions: snapshot.candidates.filter((candidate) => candidate.relevance === 'relevant').length,
    runs: snapshot.runs.length,
    runCompanyErrors: snapshot.runs.reduce((sum, run) => sum + run.companyErrors.length, 0),
    alertDigests: snapshot.alertDigests.length,
    alertDigestItems: snapshot.alertDigests.reduce((sum, digest) => sum + digest.candidateIds.length, 0),
  };
}
