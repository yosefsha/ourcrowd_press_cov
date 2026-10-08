import type { AlertDigestBuilder } from '../../../src/alerts/alert-digest-builder';
import type { TrackedCompanyFilter } from '../../../src/companies/tracked-company.repository';
import { TrackedCompanyNotFound } from '../../../src/companies/tracked-company.repository';
import type { AlertDigest } from '../../../src/domain/alert-digest';
import type { FoundArticle } from '../../../src/domain/article';
import type { CompanyProfile, TrackedCompany, TrackedCompanyStatus } from '../../../src/domain/company';
import type { Relevance, RelevanceMethod } from '../../../src/domain/relevance';
import type { RunProgress, RunType } from '../../../src/domain/run';
import type { Sentiment, SentimentVerdict } from '../../../src/domain/sentiment';
import type {
  CandidateRepository,
  PendingCandidate,
  RecordedCandidates,
} from '../../../src/pipeline/candidate.repository';
import type { Clock } from '../../../src/pipeline/clock';
import type { PipelineCompanies } from '../../../src/pipeline/company-collection.service';
import type { RunHistory } from '../../../src/pipeline/run-history';
import type { RunProgressReporter } from '../../../src/runs/run-executor';

/** A stored Candidate, as the in-memory repository keeps it. */
export interface StoredCandidate {
  readonly id: number;
  readonly googleArticleId: string;
  readonly companyId: number;
  readonly fetchedInRunId: number;
  relevance: Relevance;
  relevanceMethod: RelevanceMethod | null;
  relevanceReason: string | null;
  sentiment: Sentiment | null;
  confirmedInRunId: number | null;
}

/** The in-memory `CandidateRepository`, with the same keys and rules as Postgres. */
export class InMemoryCandidateRepository implements CandidateRepository {
  readonly articles = new Map<string, FoundArticle>();
  readonly candidates: StoredCandidate[] = [];
  readonly discarded: number[] = [];
  private nextId = 1;

  recordFound(companyId: number, articles: readonly FoundArticle[], runId: number): Promise<RecordedCandidates> {
    let created = 0;
    for (const article of articles) {
      if (!this.articles.has(article.googleArticleId)) this.articles.set(article.googleArticleId, article);
      const exists = this.candidates.some(
        (candidate) => candidate.googleArticleId === article.googleArticleId && candidate.companyId === companyId,
      );
      if (exists) continue;
      this.candidates.push({
        id: this.nextId++,
        googleArticleId: article.googleArticleId,
        companyId,
        fetchedInRunId: runId,
        relevance: 'pending',
        relevanceMethod: null,
        relevanceReason: null,
        sentiment: null,
        confirmedInRunId: null,
      });
      created += 1;
    }
    return Promise.resolve({ created });
  }

  pendingFor(companyId: number): Promise<readonly PendingCandidate[]> {
    const pending = this.candidates
      .filter((candidate) => candidate.companyId === companyId && candidate.relevance === 'pending')
      .map((candidate) => ({ candidate, article: this.articles.get(candidate.googleArticleId) as FoundArticle }))
      .sort((a, b) => b.article.publishedAt.getTime() - a.article.publishedAt.getTime() || a.candidate.id - b.candidate.id)
      .map(({ candidate, article }) => ({ id: candidate.id, googleArticleId: candidate.googleArticleId, article }));
    return Promise.resolve(pending);
  }

  recordRejection(candidateId: number, method: RelevanceMethod, reason: string): Promise<void> {
    const candidate = this.pending(candidateId);
    if (candidate !== null) {
      candidate.relevance = 'rejected';
      candidate.relevanceMethod = method;
      candidate.relevanceReason = reason;
    }
    return Promise.resolve();
  }

  recordMention(candidateId: number, relevanceReason: string, sentiment: SentimentVerdict, runId: number): Promise<void> {
    const candidate = this.pending(candidateId);
    if (candidate !== null) {
      candidate.relevance = 'relevant';
      candidate.relevanceMethod = 'llm';
      candidate.relevanceReason = relevanceReason;
      candidate.sentiment = sentiment.sentiment;
      candidate.confirmedInRunId = runId;
    }
    return Promise.resolve();
  }

  discardCompany(companyId: number): Promise<void> {
    this.discarded.push(companyId);
    for (let index = this.candidates.length - 1; index >= 0; index -= 1) {
      if (this.candidates[index]?.companyId === companyId) this.candidates.splice(index, 1);
    }
    for (const googleArticleId of [...this.articles.keys()]) {
      if (!this.candidates.some((candidate) => candidate.googleArticleId === googleArticleId)) {
        this.articles.delete(googleArticleId);
      }
    }
    return Promise.resolve();
  }

  /** The Candidates of one company, by Article title. */
  byTitle(companyId: number): ReadonlyMap<string, StoredCandidate> {
    return new Map(
      this.candidates
        .filter((candidate) => candidate.companyId === companyId)
        .map((candidate) => [this.articles.get(candidate.googleArticleId)?.title ?? '', candidate]),
    );
  }

  private pending(candidateId: number): StoredCandidate | null {
    const candidate = this.candidates.find((stored) => stored.id === candidateId);
    return candidate !== undefined && candidate.relevance === 'pending' ? candidate : null;
  }
}

/** A Tracked Company for the in-memory repository. */
export function trackedCompany(
  id: number,
  profile: Partial<CompanyProfile> & Pick<CompanyProfile, 'displayName'>,
  status: TrackedCompanyStatus = 'active',
): TrackedCompany {
  return {
    id,
    sourceName: profile.displayName,
    status,
    reviewReason: status === 'needs_review' ? 'A common word; a search mostly returns unrelated articles.' : null,
    coverageCapped: false,
    profile: { aliases: [], domain: null, description: null, searchTerms: [], ...profile },
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };
}

/** The slice of the in-memory `TrackedCompanyRepository` the pipeline uses. */
export class InMemoryPipelineCompanies implements PipelineCompanies {
  readonly cappedRecords: { id: number; capped: boolean }[] = [];

  constructor(private readonly companies: readonly TrackedCompany[]) {}

  list(filter: TrackedCompanyFilter = {}): Promise<readonly TrackedCompany[]> {
    return Promise.resolve(
      this.companies
        .filter((company) => filter.statuses === undefined || filter.statuses.includes(company.status))
        .filter((company) => filter.ids === undefined || filter.ids.includes(company.id))
        .sort((a, b) => a.profile.displayName.localeCompare(b.profile.displayName)),
    );
  }

  recordCoverageCapped(id: number, capped: boolean): Promise<void> {
    if (!this.companies.some((company) => company.id === id)) return Promise.reject(new TrackedCompanyNotFound(id));
    this.cappedRecords.push({ id, capped });
    return Promise.resolve();
  }
}

export class FixedClock implements Clock {
  constructor(private instant: Date) {}

  now(): Date {
    return this.instant;
  }

  set(instant: Date): void {
    this.instant = instant;
  }
}

export class InMemoryRunHistory implements RunHistory {
  private readonly successes: { id: number; type: RunType; startedAt: Date; scoped: boolean }[] = [];

  /** A completed Run; `scoped` when it was limited to some companies. */
  recordSuccess(id: number, type: RunType, startedAt: Date, scoped = false): void {
    this.successes.push({ id, type, startedAt, scoped });
  }

  lastSuccessfulStart(type: RunType, excludingRunId: number): Promise<Date | null> {
    const starts = this.successes
      .filter((run) => run.type === type && run.id !== excludingRunId && !run.scoped)
      .map((run) => run.startedAt.getTime());
    return Promise.resolve(starts.length === 0 ? null : new Date(Math.max(...starts)));
  }
}

/** Records the Runs it was asked to build a digest for; builds nothing itself. */
export class RecordingDigestBuilder implements AlertDigestBuilder {
  readonly runIds: number[] = [];
  failure: Error | null = null;

  buildForRun(runId: number): Promise<AlertDigest | null> {
    this.runIds.push(runId);
    return this.failure === null ? Promise.resolve(null) : Promise.reject(this.failure);
  }
}

export class RecordingProgress implements RunProgressReporter {
  readonly reports: RunProgress[] = [];

  report(progress: RunProgress): Promise<void> {
    this.reports.push(progress);
    return Promise.resolve();
  }

  get last(): RunProgress | undefined {
    return this.reports[this.reports.length - 1];
  }
}
