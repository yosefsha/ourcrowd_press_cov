import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { asAlertMention, recordedMention } from '../../../test/fixtures/alerts/recorded-mentions';
import type { AlertDigest } from '../../domain/alert-digest';
import { AlertDeliveryFailed } from '../alert-notifier';
import { alertDigestFileName, FileAlertNotifier } from './file-alert-notifier';

const recorded = recordedMention('zutacoreDcdPartnership', 7, 'negative', 42);

const DIGEST: AlertDigest = {
  id: 3,
  runId: 42,
  // 22:30 UTC is already the next day in Asia/Jerusalem.
  createdAt: new Date('2026-10-06T22:30:00Z'),
  acknowledgedAt: null,
  companies: [{ companyId: recorded.companyId, displayName: recorded.displayName, mentions: [asAlertMention(recorded)] }],
};

describe('alertDigestFileName', () => {
  it('dates the file by the creation day in the configured time zone', () => {
    expect(alertDigestFileName(DIGEST, 'Asia/Jerusalem')).toBe('2026-10-07-run42.json');
    expect(alertDigestFileName(DIGEST, 'UTC')).toBe('2026-10-06-run42.json');
  });
});

describe('FileAlertNotifier', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'alert-notifier-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the digest as JSON under alerts/, leaving no temporary file', async () => {
    await new FileAlertNotifier({ dataExportDir: dir, timeZone: 'Asia/Jerusalem' }).notify(DIGEST);

    expect(await readdir(join(dir, 'alerts'))).toEqual(['2026-10-07-run42.json']);
    const written: unknown = JSON.parse(await readFile(join(dir, 'alerts', '2026-10-07-run42.json'), 'utf8'));
    expect(written).toEqual(JSON.parse(JSON.stringify(DIGEST)));
  });

  it('replaces the file when the same digest is written again', async () => {
    const notifier = new FileAlertNotifier({ dataExportDir: dir, timeZone: 'Asia/Jerusalem' });

    await notifier.notify(DIGEST);
    await notifier.notify({ ...DIGEST, acknowledgedAt: new Date('2026-10-07T08:00:00Z') });

    expect(await readdir(join(dir, 'alerts'))).toEqual(['2026-10-07-run42.json']);
    const written = JSON.parse(await readFile(join(dir, 'alerts', '2026-10-07-run42.json'), 'utf8')) as {
      acknowledgedAt: string;
    };
    expect(written.acknowledgedAt).toBe('2026-10-07T08:00:00.000Z');
  });

  it('fails with AlertDeliveryFailed when the folder cannot be created', async () => {
    const blocker = join(dir, 'not-a-folder');
    await writeFile(blocker, '');

    const notify = new FileAlertNotifier({ dataExportDir: blocker, timeZone: 'UTC' }).notify(DIGEST);

    await expect(notify).rejects.toBeInstanceOf(AlertDeliveryFailed);
    await expect(notify).rejects.toMatchObject({ channel: 'file' });
  });
});
