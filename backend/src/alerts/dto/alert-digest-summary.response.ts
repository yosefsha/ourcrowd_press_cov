import type { StoredAlertDigestSummary } from '../alert-digest.repository';

/** An Alert Digest as listed for the alert bell — `AlertDigestSummary` in frontend/src/types.ts. */
export class AlertDigestSummaryResponse {
  readonly id: number;
  readonly runId: number;
  readonly createdAt: string;
  readonly acknowledgedAt: string | null;
  readonly mentionCount: number;
  readonly companyCount: number;
  readonly negativeMentionCount: number;

  constructor(summary: StoredAlertDigestSummary) {
    this.id = summary.id;
    this.runId = summary.runId;
    this.createdAt = summary.createdAt.toISOString();
    this.acknowledgedAt = summary.acknowledgedAt?.toISOString() ?? null;
    this.mentionCount = summary.mentionCount;
    this.companyCount = summary.companyCount;
    this.negativeMentionCount = summary.negativeMentionCount;
  }
}
