import type { AlertDigest } from '../../domain/alert-digest';
import type { AlertNotifier } from '../alert-notifier';

/** Where the log notifier writes; Nest's `Logger` satisfies it. */
export interface AlertLog {
  log(message: string): void;
}

/** Feed text on one line: a title carrying line breaks or control characters cannot forge log lines. */
function oneLine(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').trim();
}

/** A readable, multi-line summary of a digest: companies in digest order, negative Mentions first. */
export function formatAlertDigest(digest: AlertDigest): string {
  const mentions = digest.companies.reduce((total, group) => total + group.mentions.length, 0);
  const negatives = digest.companies.reduce(
    (total, group) => total + group.mentions.filter((mention) => mention.sentiment === 'negative').length,
    0,
  );
  const lines = [
    `Alert Digest ${digest.id} (Run ${digest.runId}): ${mentions} New ${mentions === 1 ? 'Mention' : 'Mentions'} ` +
      `across ${digest.companies.length} ${digest.companies.length === 1 ? 'company' : 'companies'}, ${negatives} negative`,
  ];
  for (const group of digest.companies) {
    lines.push(`  ${oneLine(group.displayName)}`);
    for (const mention of group.mentions) {
      lines.push(
        `    [${mention.sentiment}] ${oneLine(mention.title)} — ${oneLine(mention.outletName)}, ` +
          `${mention.publishedAt.toISOString().slice(0, 10)} ${oneLine(mention.url)}`,
      );
    }
  }
  return lines.join('\n');
}

/** Writes a readable summary of each Alert Digest to the collector's log (ADR-004). */
export class LogAlertNotifier implements AlertNotifier {
  constructor(private readonly log: AlertLog) {}

  notify(digest: AlertDigest): Promise<void> {
    this.log.log(formatAlertDigest(digest));
    return Promise.resolve();
  }
}
