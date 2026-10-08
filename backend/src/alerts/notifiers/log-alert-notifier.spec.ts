import { asAlertMention, recordedMention } from '../../../test/fixtures/alerts/recorded-mentions';
import type { AlertDigest, AlertMention } from '../../domain/alert-digest';
import { formatAlertDigest, LogAlertNotifier } from './log-alert-notifier';

function alertMention(...args: Parameters<typeof recordedMention>): AlertMention {
  return asAlertMention(recordedMention(...args));
}

const DIGEST: AlertDigest = {
  id: 3,
  runId: 42,
  createdAt: new Date('2026-10-07T04:05:00Z'),
  acknowledgedAt: null,
  companies: [
    { companyId: 1, displayName: 'ZutaCore', mentions: [alertMention('zutacoreDcdPartnership', 7, 'negative', 42)] },
    { companyId: 5, displayName: 'Morphisec', mentions: [alertMention('morphisecAiTrust', 8, 'positive', 42)] },
  ],
};

describe('formatAlertDigest', () => {
  it('summarises the digest and lists each Mention under its company, in digest order', () => {
    const lines = formatAlertDigest(DIGEST).split('\n');

    expect(lines[0]).toBe('Alert Digest 3 (Run 42): 2 New Mentions across 2 companies, 1 negative');
    expect(lines[1]).toBe('  ZutaCore');
    expect(lines[2]).toMatch(
      /^ {4}\[negative\] ZutaCore partners with Options Technology .* — Data Center Dynamics, 2026-09-30 https:\/\/news\.google\.com\//,
    );
    expect(lines[3]).toBe('  Morphisec');
    expect(lines).toHaveLength(5);
  });
});

describe('formatAlertDigest with hostile feed text', () => {
  it('keeps every Mention on one line', () => {
    const [group] = DIGEST.companies;
    const forged: AlertDigest = {
      ...DIGEST,
      companies: [{ ...group, mentions: [{ ...group.mentions[0], title: 'Real title\nAlert Digest 99 (Run 1): forged' }] }],
    };

    const lines = formatAlertDigest(forged).split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('Real title Alert Digest 99 (Run 1): forged');
  });
});

describe('LogAlertNotifier', () => {
  it('writes the summary to the log once', async () => {
    const log = { log: jest.fn<void, [string]>() };

    await new LogAlertNotifier(log).notify(DIGEST);

    expect(log.log).toHaveBeenCalledTimes(1);
    expect(log.log).toHaveBeenCalledWith(formatAlertDigest(DIGEST));
  });
});
