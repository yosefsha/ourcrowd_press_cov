import type { AlertMention } from '../../domain/alert-digest';

/** Injection token for the `AlertDigestStore` port. */
export const ALERT_DIGEST_STORE = Symbol('ALERT_DIGEST_STORE');

/** A New Mention with the Tracked Company it belongs to. */
export interface NewMention extends AlertMention {
  readonly companyId: number;
  readonly displayName: string;
}

/** The stored row of a newly created digest. */
export interface CreatedAlertDigest {
  readonly id: number;
  readonly createdAt: Date;
}

/** A digest already stored for a Run, with the New Mentions it lists. */
export interface StoredRunDigest extends CreatedAlertDigest {
  readonly acknowledgedAt: Date | null;
  readonly mentions: readonly NewMention[];
}

/** Where the Alert Digest builder finds New Mentions and stores digests (collector side). */
export interface AlertDigestStore {
  /**
   * The Mentions first confirmed in `runId` whose Article was published at or
   * after `publishedSince` (ADR-004), in no particular order.
   * Throws `AlertDigestStoreUnavailable`.
   */
  findNewMentions(runId: number, publishedSince: Date): Promise<readonly NewMention[]>;
  /** The digest already stored for `runId`, if any. Throws `AlertDigestStoreUnavailable`. */
  findDigestForRun(runId: number): Promise<StoredRunDigest | null>;
  /** Stores one digest of `candidateIds` for `runId`, atomically. Throws `AlertDigestStoreUnavailable`. */
  createDigest(runId: number, candidateIds: readonly number[]): Promise<CreatedAlertDigest>;
}

export class AlertDigestStoreUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AlertDigestStoreUnavailable';
  }
}
