import type { Sentiment } from '../domain/sentiment';

/** Injection token for the `AlertDigestRepository` port. */
export const ALERT_DIGEST_REPOSITORY = Symbol('ALERT_DIGEST_REPOSITORY');

/** An Alert Digest as the dashboard lists it, with its counts. */
export interface StoredAlertDigestSummary {
  readonly id: number;
  readonly runId: number;
  readonly createdAt: Date;
  readonly acknowledgedAt: Date | null;
  readonly mentionCount: number;
  readonly companyCount: number;
  readonly negativeMentionCount: number;
}

/** A stored Article, as shown inside an Alert Digest. */
export interface AlertArticle {
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

/** One New Mention listed in a stored Alert Digest, with its Tracked Company. */
export interface StoredAlertMention {
  readonly candidateId: number;
  readonly companyId: number;
  readonly displayName: string;
  readonly sentiment: Sentiment;
  readonly article: AlertArticle;
}

/** A stored Alert Digest with every New Mention it lists, in no particular order. */
export interface StoredAlertDigest {
  readonly summary: StoredAlertDigestSummary;
  readonly mentions: readonly StoredAlertMention[];
}

export interface AlertDigestFilter {
  /** true: acknowledged only; false: unacknowledged only; undefined: all. */
  readonly acknowledged?: boolean;
  /** At most this many digests, newest first. */
  readonly limit: number;
}

/** Stored Alert Digests as the dashboard reads and acknowledges them (ADR-004). */
export interface AlertDigestRepository {
  /** Newest first. */
  list(filter: AlertDigestFilter): Promise<readonly StoredAlertDigestSummary[]>;
  /** Throws `AlertDigestNotFound`. */
  get(id: number): Promise<StoredAlertDigest>;
  /**
   * Marks the digest acknowledged at `at` unless it already is — the first
   * acknowledgement is kept. Throws `AlertDigestNotFound`.
   */
  acknowledge(id: number, at: Date): Promise<StoredAlertDigestSummary>;
}

export class AlertDigestNotFound extends Error {
  constructor(readonly digestId: number) {
    super(`Alert Digest ${digestId} not found`);
    this.name = 'AlertDigestNotFound';
  }
}
