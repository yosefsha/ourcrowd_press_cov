import { Logger } from '@nestjs/common';

import type { AlertDigest, AlertDigestCompanyGroup, AlertMention } from '../../domain/alert-digest';
import { groupNegativeFirst } from '../alert-digest-ordering';
import type { AlertDigestBuilder } from '../alert-digest-builder';
import { AlertDeliveryFailed, type AlertNotifier } from '../alert-notifier';
import type { AlertDigestStore, NewMention } from './alert-digest.store';

const MS_PER_DAY = 86_400_000;

export interface NewMentionPolicy {
  /** A Mention published longer ago than this is no longer news (`NEW_MENTION_MAX_AGE_DAYS`). */
  readonly maxAgeDays: number;
}

/**
 * Builds the Alert Digest of a Daily Check from its New Mentions — Mentions
 * first confirmed in that Run and published within `maxAgeDays` — stores it
 * (the dashboard channel) and hands it to every notifier (ADR-004).
 *
 * Building is idempotent per Run: a Run that already has a digest gets that
 * digest back and nothing is delivered twice.
 */
export class NewMentionAlertDigestBuilder implements AlertDigestBuilder {
  private readonly logger = new Logger(NewMentionAlertDigestBuilder.name);

  constructor(
    private readonly store: AlertDigestStore,
    private readonly notifiers: readonly AlertNotifier[],
    private readonly policy: NewMentionPolicy,
    private readonly now: () => Date,
  ) {}

  async buildForRun(runId: number): Promise<AlertDigest | null> {
    const existing = await this.store.findDigestForRun(runId);
    if (existing !== null) {
      this.logger.log(`Run ${runId} already has Alert Digest ${existing.id}; not delivering it again`);
      return toDigest(runId, existing.id, existing.createdAt, existing.acknowledgedAt, existing.mentions);
    }

    const publishedSince = new Date(this.now().getTime() - this.policy.maxAgeDays * MS_PER_DAY);
    const mentions = await this.store.findNewMentions(runId, publishedSince);
    if (mentions.length === 0) {
      this.logger.log(`Run ${runId}: no new mentions, no Alert Digest`);
      return null;
    }

    const created = await this.store.createDigest(
      runId,
      mentions.map((mention) => mention.candidateId),
    );
    const digest = toDigest(runId, created.id, created.createdAt, null, mentions);
    if (digest === null) return null;
    await this.deliver(digest);
    return digest;
  }

  /**
   * The stored digest is already visible in the dashboard, so a channel that
   * fails is logged and the others still run; anything other than the port's
   * own `AlertDeliveryFailed` is a defect and propagates.
   */
  private async deliver(digest: AlertDigest): Promise<void> {
    for (const notifier of this.notifiers) {
      try {
        await notifier.notify(digest);
      } catch (error) {
        if (!(error instanceof AlertDeliveryFailed)) throw error;
        this.logger.error(`Alert Digest ${digest.id}: ${error.message}`, error.cause instanceof Error ? error.cause.stack : undefined);
      }
    }
  }
}

function toDigest(
  runId: number,
  id: number,
  createdAt: Date,
  acknowledgedAt: Date | null,
  mentions: readonly NewMention[],
): AlertDigest | null {
  const groups = groupNegativeFirst(mentions, (mention) => mention.publishedAt).map(
    (group): AlertDigestCompanyGroup => ({
      companyId: group.companyId,
      displayName: group.displayName,
      mentions: [toAlertMention(group.mentions[0]), ...group.mentions.slice(1).map(toAlertMention)],
    }),
  );
  const [first, ...rest] = groups;
  if (first === undefined) return null;
  return { id, runId, createdAt, acknowledgedAt, companies: [first, ...rest] };
}

function toAlertMention(mention: NewMention): AlertMention {
  return {
    candidateId: mention.candidateId,
    sentiment: mention.sentiment,
    title: mention.title,
    outletName: mention.outletName,
    url: mention.url,
    publishedAt: mention.publishedAt,
  };
}
