import type { AlertDigestStore, CreatedAlertDigest, NewMention, StoredRunDigest } from './alert-digest.store';

/** A Mention as the in-memory store holds it: a New Mention plus the Run that confirmed it. */
export interface InMemoryMention extends NewMention {
  readonly confirmedInRunId: number;
}

/** In-memory `AlertDigestStore` for tests; same contract as the Postgres one. */
export class InMemoryAlertDigestStore implements AlertDigestStore {
  private readonly digests = new Map<number, StoredRunDigest>();
  private nextId = 1;

  constructor(
    private readonly mentions: readonly InMemoryMention[],
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Digests stored so far, keyed by Run id. */
  get storedDigests(): ReadonlyMap<number, StoredRunDigest> {
    return this.digests;
  }

  findNewMentions(runId: number, publishedSince: Date): Promise<readonly NewMention[]> {
    return Promise.resolve(
      this.mentions
        .filter(
          (mention) =>
            mention.confirmedInRunId === runId && mention.publishedAt.getTime() >= publishedSince.getTime(),
        )
        .map(({ confirmedInRunId: _run, ...mention }) => mention),
    );
  }

  findDigestForRun(runId: number): Promise<StoredRunDigest | null> {
    return Promise.resolve(this.digests.get(runId) ?? null);
  }

  createDigest(runId: number, candidateIds: readonly number[]): Promise<CreatedAlertDigest> {
    if (this.digests.has(runId)) {
      return Promise.reject(new Error(`Run ${runId} already has an Alert Digest`));
    }
    const listed = new Set(candidateIds);
    const created = { id: this.nextId++, createdAt: this.now() };
    this.digests.set(runId, {
      ...created,
      acknowledgedAt: null,
      mentions: this.mentions
        .filter((mention) => listed.has(mention.candidateId))
        .map(({ confirmedInRunId: _run, ...mention }) => mention),
    });
    return Promise.resolve(created);
  }
}
