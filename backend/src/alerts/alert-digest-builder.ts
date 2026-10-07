import type { AlertDigest } from '../domain/alert-digest';

/** Injection token for the `AlertDigestBuilder` port. */
export const ALERT_DIGEST_BUILDER = Symbol('ALERT_DIGEST_BUILDER');

/** Builds and stores the Alert Digest of a Daily Check (ADR-004). */
export interface AlertDigestBuilder {
  /**
   * Stores one digest of the New Mentions first confirmed in the given Daily
   * Check and returns it; null — and nothing stored — when there are none.
   */
  buildForRun(runId: number): Promise<AlertDigest | null>;
}
