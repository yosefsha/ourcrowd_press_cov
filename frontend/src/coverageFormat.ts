import { SENTIMENTS, type IsoDateTime, type MentionStatus, type SentimentSplit } from './types.ts';

/** Display names of the Mention Statuses (CONTEXT.md). */
export const MENTION_STATUS_LABELS: Readonly<Record<MentionStatus, string>> = {
  active: 'Active',
  recent: 'Recent',
  quiet: 'Quiet',
  no_coverage: 'No coverage',
};

const DAY_MS = 86_400_000;

const relativeDays = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const calendarDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

/** "today", "yesterday", "3 days ago" — whole days between `at` and `now`. */
export function formatDaysAgo(at: IsoDateTime, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(at).getTime()) / DAY_MS));
  return relativeDays.format(-days, 'day');
}

export function formatCalendarDate(at: IsoDateTime): string {
  return calendarDate.format(new Date(at));
}

/**
 * The line under a company's Mention Status badge: how long ago it was last
 * mentioned, or — with no Mention ever found — since when nothing was found.
 */
export function describeLastMention(
  lastMentionAt: IsoDateTime | null,
  now: Date,
  noCoverageSince: IsoDateTime | null,
): string {
  if (lastMentionAt !== null) return formatDaysAgo(lastMentionAt, now);
  return noCoverageSince === null
    ? 'No coverage found'
    : `No coverage found since ${formatCalendarDate(noCoverageSince)}`;
}

/** Mentions in the window; a "+" marks a count cut short by the News Source's result cap. */
export function formatMentionCount(mentionCount: number, capped: boolean): string {
  return capped ? `${mentionCount}+` : String(mentionCount);
}

/** Only http(s) links from the API are rendered as links; anything else is dropped. */
export function toSafeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Describes a split for assistive technology, e.g. "3 positive, 1 negative, 2 neutral". */
export function describeSentiment(sentiment: SentimentSplit): string {
  return SENTIMENTS.map((key) => `${sentiment[key]} ${key}`).join(', ');
}
