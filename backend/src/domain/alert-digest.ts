import type { Sentiment } from './sentiment';

/** A New Mention inside an Alert Digest. */
export interface AlertMention {
  readonly candidateId: number;
  readonly sentiment: Sentiment;
  readonly title: string;
  readonly outletName: string;
  /** The publisher URL when resolved, otherwise the Google News link. */
  readonly url: string;
  readonly publishedAt: Date;
}

/** The New Mentions for one Tracked Company, negative ones first. */
export interface AlertDigestCompanyGroup {
  readonly companyId: number;
  readonly displayName: string;
  readonly mentions: readonly [AlertMention, ...AlertMention[]];
}

/**
 * The single summary of all New Mentions found by one Daily Check, grouped by
 * Tracked Company with negative Mentions first (ADR-004). A Daily Check with no
 * New Mentions has no digest, so a digest always has at least one group.
 */
export interface AlertDigest {
  readonly id: number;
  readonly runId: number;
  readonly createdAt: Date;
  readonly acknowledgedAt: Date | null;
  readonly companies: readonly [AlertDigestCompanyGroup, ...AlertDigestCompanyGroup[]];
}
