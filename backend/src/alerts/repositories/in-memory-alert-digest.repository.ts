import {
  AlertDigestNotFound,
  type AlertDigestFilter,
  type AlertDigestRepository,
  type StoredAlertDigest,
  type StoredAlertDigestSummary,
  type StoredAlertMention,
} from '../alert-digest.repository';

/** A digest as the in-memory repository holds it; counts are derived from `mentions`. */
export interface InMemoryAlertDigest {
  readonly id: number;
  readonly runId: number;
  readonly createdAt: Date;
  readonly acknowledgedAt: Date | null;
  readonly mentions: readonly StoredAlertMention[];
}

/** In-memory `AlertDigestRepository` for tests; same contract as the Postgres one. */
export class InMemoryAlertDigestRepository implements AlertDigestRepository {
  private readonly digests = new Map<number, InMemoryAlertDigest>();

  constructor(digests: readonly InMemoryAlertDigest[] = []) {
    for (const digest of digests) this.digests.set(digest.id, digest);
  }

  list(filter: AlertDigestFilter): Promise<readonly StoredAlertDigestSummary[]> {
    const summaries = [...this.digests.values()]
      .filter(
        (digest) => filter.acknowledged === undefined || (digest.acknowledgedAt !== null) === filter.acknowledged,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
      .slice(0, filter.limit)
      .map(summarize);
    return Promise.resolve(summaries);
  }

  get(id: number): Promise<StoredAlertDigest> {
    const digest = this.digests.get(id);
    if (digest === undefined) return Promise.reject(new AlertDigestNotFound(id));
    return Promise.resolve({ summary: summarize(digest), mentions: digest.mentions });
  }

  acknowledge(id: number, at: Date): Promise<StoredAlertDigestSummary> {
    const digest = this.digests.get(id);
    if (digest === undefined) return Promise.reject(new AlertDigestNotFound(id));
    const acknowledged = digest.acknowledgedAt === null ? { ...digest, acknowledgedAt: at } : digest;
    this.digests.set(id, acknowledged);
    return Promise.resolve(summarize(acknowledged));
  }
}

function summarize(digest: InMemoryAlertDigest): StoredAlertDigestSummary {
  return {
    id: digest.id,
    runId: digest.runId,
    createdAt: digest.createdAt,
    acknowledgedAt: digest.acknowledgedAt,
    mentionCount: digest.mentions.length,
    companyCount: new Set(digest.mentions.map((mention) => mention.companyId)).size,
    negativeMentionCount: digest.mentions.filter((mention) => mention.sentiment === 'negative').length,
  };
}
