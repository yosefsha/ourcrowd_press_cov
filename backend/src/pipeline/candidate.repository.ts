import type { ClassifiableArticle, FoundArticle } from '../domain/article';
import type { RelevanceMethod } from '../domain/relevance';
import type { SentimentVerdict } from '../domain/sentiment';

/** Injection token for the `CandidateRepository` port. */
export const CANDIDATE_REPOSITORY = Symbol('CANDIDATE_REPOSITORY');

/** A Candidate still waiting for its Relevance Verdict, with the Article text the classifiers read. */
export interface PendingCandidate {
  readonly id: number;
  readonly googleArticleId: string;
  readonly article: ClassifiableArticle;
}

/** What storing one company's found Articles changed. */
export interface RecordedCandidates {
  /** Candidates created by this call; Articles already known for the company are not counted. */
  readonly created: number;
}

/**
 * The Articles and Candidates the pipeline collects and classifies (ADR-008):
 * one Article per Google article ID, one Candidate per (Article, company).
 */
export interface CandidateRepository {
  /**
   * Stores `articles` (once each, by Google article ID) as Candidates for the
   * company. Existing Articles and Candidates are kept as they are, so a Run
   * can be repeated without losing a verdict. Throws `CandidateStoreFailed`.
   */
  recordFound(companyId: number, articles: readonly FoundArticle[], runId: number): Promise<RecordedCandidates>;

  /** The company's Candidates without a Relevance Verdict, newest first. Throws `CandidateStoreFailed`. */
  pendingFor(companyId: number): Promise<readonly PendingCandidate[]>;

  /** Rejects a pending Candidate; a Candidate already judged is left alone. Throws `CandidateStoreFailed`. */
  recordRejection(candidateId: number, method: RelevanceMethod, reason: string): Promise<void>;

  /**
   * Confirms a pending Candidate as a Mention with its Sentiment, stamping the
   * Run that confirmed it — what makes it a New Mention of that Run (ADR-004).
   * A Candidate already judged is left alone. Throws `CandidateStoreFailed`.
   */
  recordMention(candidateId: number, relevanceReason: string, sentiment: SentimentVerdict, runId: number): Promise<void>;

  /**
   * Re-process: deletes every Candidate of the company — and with them its
   * Mentions and their Alert Digest entries — and every Article no other
   * company still has a Candidate for. Throws `CandidateStoreFailed`.
   */
  discardCompany(companyId: number): Promise<void>;
}

/** The Candidate store could not be read or written. */
export class CandidateStoreFailed extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CandidateStoreFailed';
  }
}
