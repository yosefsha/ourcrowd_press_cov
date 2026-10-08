import { Logger } from '@nestjs/common';

import { asAlertMention, recordedMention } from '../../../test/fixtures/alerts/recorded-mentions';
import type { AlertNotifier } from '../alert-notifier';
import { AlertDigestStoreUnavailable } from './alert-digest.store';
import { InMemoryAlertDigestStore, type InMemoryMention } from './in-memory-alert-digest.store';
import { InMemoryAlertNotifier } from './in-memory-alert-notifier';
import { NewMentionAlertDigestBuilder } from './new-mention-alert-digest.builder';

// Three days after the newest recorded articles (2026-09-30).
const NOW = new Date('2026-10-03T07:00:00Z');
const DAILY_CHECK = 2;
const EARLIER_RUN = 1;

function setup(
  mentions: readonly InMemoryMention[],
  notifiers: readonly AlertNotifier[] = [new InMemoryAlertNotifier()],
): { builder: NewMentionAlertDigestBuilder; store: InMemoryAlertDigestStore } {
  const store = new InMemoryAlertDigestStore(mentions, () => NOW);
  const builder = new NewMentionAlertDigestBuilder(store, notifiers, { maxAgeDays: 7 }, () => NOW);
  return { builder, store };
}

describe('NewMentionAlertDigestBuilder', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('leaves out a Mention published 10 days before the Daily Check', async () => {
    const { builder } = setup([
      recordedMention('morphisecAiTrust', 11, 'positive', DAILY_CHECK),
      recordedMention('zutacoreBusinessWirePartnership', 12, 'positive', DAILY_CHECK), // 2026-09-23
    ]);

    const digest = await builder.buildForRun(DAILY_CHECK);

    expect(digest?.companies.flatMap((group) => group.mentions.map((m) => m.candidateId))).toEqual([11]);
  });

  it('keeps a Mention published exactly NEW_MENTION_MAX_AGE_DAYS ago', async () => {
    const mention = recordedMention('morphisecAiTrust', 11, 'positive', DAILY_CHECK);
    const sevenDaysAfter = new Date(mention.publishedAt.getTime() + 7 * 86_400_000);
    const oneMsLater = new Date(sevenDaysAfter.getTime() + 1);
    const builderAt = (now: Date): NewMentionAlertDigestBuilder =>
      new NewMentionAlertDigestBuilder(new InMemoryAlertDigestStore([mention]), [], { maxAgeDays: 7 }, () => now);

    await expect(builderAt(sevenDaysAfter).buildForRun(DAILY_CHECK)).resolves.not.toBeNull();
    await expect(builderAt(oneMsLater).buildForRun(DAILY_CHECK)).resolves.toBeNull();
  });

  it('includes a Mention confirmed in this Run even though an earlier, failed Run fetched it', async () => {
    // Fetched by Run 1, left unclassified when it failed, confirmed by Run 2.
    const lateConfirmed = recordedMention('zutacoreDcdPartnership', 21, 'neutral', DAILY_CHECK);
    const confirmedEarlier = recordedMention('morphisecAiTrust', 22, 'positive', EARLIER_RUN);
    const { builder } = setup([lateConfirmed, confirmedEarlier]);

    const digest = await builder.buildForRun(DAILY_CHECK);

    expect(digest?.companies).toEqual([
      expect.objectContaining({ displayName: 'ZutaCore', mentions: [expect.objectContaining({ candidateId: 21 })] }),
    ]);
  });

  it('puts companies with negative Mentions first, and negative Mentions first within a company', async () => {
    const { builder } = setup([
      recordedMention('morphisecAiTrust', 31, 'positive', DAILY_CHECK),
      recordedMention('zutacoreDcdPartnership', 32, 'negative', DAILY_CHECK),
    ]);

    const digest = await builder.buildForRun(DAILY_CHECK);

    expect(digest?.companies.map((group) => group.displayName)).toEqual(['ZutaCore', 'Morphisec']);
    expect(digest?.companies[0].mentions[0]).toEqual(
      asAlertMention(recordedMention('zutacoreDcdPartnership', 32, 'negative', DAILY_CHECK)),
    );
    expect(digest?.companies[0].mentions[0].url).toMatch(/^https:\/\/news\.google\.com\/rss\/articles\/CBMi/);
  });

  it('stores nothing and notifies nobody when the Daily Check has no New Mentions', async () => {
    const notifier = new InMemoryAlertNotifier();
    const { builder, store } = setup([recordedMention('morphisecAiTrust', 41, 'positive', EARLIER_RUN)], [notifier]);

    await expect(builder.buildForRun(DAILY_CHECK)).resolves.toBeNull();

    expect(store.storedDigests.size).toBe(0);
    expect(notifier.delivered).toHaveLength(0);
    expect(logSpy).toHaveBeenCalledWith('Run 2: no new mentions, no Alert Digest');
  });

  it('stores the digest and invokes every notifier exactly once', async () => {
    const log = new InMemoryAlertNotifier();
    const file = new InMemoryAlertNotifier();
    const { builder, store } = setup([recordedMention('morphisecAiTrust', 51, 'positive', DAILY_CHECK)], [log, file]);

    const digest = await builder.buildForRun(DAILY_CHECK);

    expect(digest).toMatchObject({ id: 1, runId: DAILY_CHECK, createdAt: NOW, acknowledgedAt: null });
    expect(store.storedDigests.get(DAILY_CHECK)?.mentions.map((m) => m.candidateId)).toEqual([51]);
    expect(log.delivered).toEqual([digest]);
    expect(file.delivered).toEqual([digest]);
  });

  it('returns the stored digest without delivering it again when the Run is built twice', async () => {
    const notifier = new InMemoryAlertNotifier();
    const { builder } = setup([recordedMention('morphisecAiTrust', 61, 'positive', DAILY_CHECK)], [notifier]);

    const first = await builder.buildForRun(DAILY_CHECK);
    const second = await builder.buildForRun(DAILY_CHECK);

    expect(second).toEqual(first);
    expect(notifier.delivered).toHaveLength(1);
  });

  it('logs a failed channel and still delivers to the others', async () => {
    const failing = new InMemoryAlertNotifier('disk full');
    const working = new InMemoryAlertNotifier();
    const { builder } = setup([recordedMention('morphisecAiTrust', 71, 'positive', DAILY_CHECK)], [failing, working]);

    const digest = await builder.buildForRun(DAILY_CHECK);

    expect(digest).not.toBeNull();
    expect(working.delivered).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Alert Digest 1: Alert delivery via in-memory failed: disk full',
      undefined,
    );
  });

  it('propagates an error that is not a delivery failure', async () => {
    const broken: AlertNotifier = { notify: () => Promise.reject(new TypeError('bug')) };
    const { builder } = setup([recordedMention('morphisecAiTrust', 81, 'positive', DAILY_CHECK)], [broken]);

    await expect(builder.buildForRun(DAILY_CHECK)).rejects.toThrow(TypeError);
  });

  it('propagates a store failure', async () => {
    const { builder, store } = setup([]);
    jest
      .spyOn(store, 'findNewMentions')
      .mockRejectedValue(new AlertDigestStoreUnavailable('Failed finding New Mentions of Run 2'));

    await expect(builder.buildForRun(DAILY_CHECK)).rejects.toThrow(AlertDigestStoreUnavailable);
  });
});
