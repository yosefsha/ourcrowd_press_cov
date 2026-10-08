import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AlertDigest } from '../../domain/alert-digest';
import { calendarDateIn } from '../../domain/time-zone';
import { AlertDeliveryFailed, type AlertNotifier } from '../alert-notifier';

export interface FileAlertNotifierOptions {
  /** The `data/` export folder; digests go to its `alerts/` subfolder. */
  readonly dataExportDir: string;
  /** IANA zone that names the file's date (`TZ`). */
  readonly timeZone: string;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** `2026-10-07-run42.json`, dated by when the digest was created, in `timeZone`. */
export function alertDigestFileName(digest: Pick<AlertDigest, 'runId' | 'createdAt'>, timeZone: string): string {
  const { year, month, day } = calendarDateIn(digest.createdAt, timeZone);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}-run${digest.runId}.json`;
}

/**
 * Writes each Alert Digest to `${DATA_EXPORT_DIR}/alerts/<date>-run<id>.json`
 * (ADR-004, ADR-005). The file is written beside its target and renamed into
 * place, so a reader never sees a partial digest.
 */
export class FileAlertNotifier implements AlertNotifier {
  constructor(private readonly options: FileAlertNotifierOptions) {}

  async notify(digest: AlertDigest): Promise<void> {
    const dir = join(this.options.dataExportDir, 'alerts');
    const target = join(dir, alertDigestFileName(digest, this.options.timeZone));
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(temporary, `${JSON.stringify(digest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, target);
    } catch (cause) {
      await rm(temporary, { force: true }).catch(() => undefined);
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new AlertDeliveryFailed('file', `cannot write ${target}: ${reason}`, { cause });
    }
  }
}
