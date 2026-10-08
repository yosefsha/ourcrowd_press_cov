import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { groupNegativeFirst, type OrderedCompanyGroup } from './alert-digest-ordering';
import {
  ALERT_DIGEST_REPOSITORY,
  AlertDigestNotFound,
  type AlertDigestFilter,
  type AlertDigestRepository,
  type StoredAlertDigestSummary,
  type StoredAlertMention,
} from './alert-digest.repository';

/** A stored Alert Digest with its New Mentions grouped in digest order. */
export interface AlertDigestDetail {
  readonly summary: StoredAlertDigestSummary;
  readonly companies: readonly OrderedCompanyGroup<StoredAlertMention>[];
}

/** Clock for acknowledgements; injectable so tests can fix time. */
export const ALERTS_CLOCK = Symbol('ALERTS_CLOCK');
export type Clock = () => Date;

/** Reads and acknowledges Alert Digests for the dashboard (ADR-004). */
@Injectable()
export class AlertsService {
  constructor(
    @Inject(ALERT_DIGEST_REPOSITORY) private readonly repository: AlertDigestRepository,
    @Inject(ALERTS_CLOCK) private readonly now: Clock,
  ) {}

  list(filter: AlertDigestFilter): Promise<readonly StoredAlertDigestSummary[]> {
    return this.repository.list(filter);
  }

  /** Throws `NotFoundException`. */
  async get(id: number): Promise<AlertDigestDetail> {
    const digest = await this.orNotFound(this.repository.get(id));
    return {
      summary: digest.summary,
      companies: groupNegativeFirst(digest.mentions, (mention) => mention.article.publishedAt),
    };
  }

  /** Idempotent: acknowledging twice keeps the first acknowledgement. Throws `NotFoundException`. */
  acknowledge(id: number): Promise<StoredAlertDigestSummary> {
    return this.orNotFound(this.repository.acknowledge(id, this.now()));
  }

  private async orNotFound<T>(pending: Promise<T>): Promise<T> {
    try {
      return await pending;
    } catch (error) {
      if (error instanceof AlertDigestNotFound) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
