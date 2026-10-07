import { assertValidInstant, calendarDateIn, daysBetween } from './time-zone';

/** How recently a Tracked Company was last mentioned, regardless of the Coverage Window. */
export const MENTION_STATUSES = ['active', 'recent', 'quiet', 'no_coverage'] as const;
export type MentionStatus = (typeof MENTION_STATUSES)[number];

/** Upper bounds, in whole calendar days since the last Mention; anything older is Quiet. */
export const MENTION_STATUS_MAX_AGE_DAYS = {
  active: 7,
  recent: 30,
} as const;

/**
 * The Mention Status of a company whose most recent Mention was published at
 * `lastMentionAt` (null when it has none), as of `now`.
 *
 * Age is counted in calendar days in `timeZone`: a Mention from earlier today is
 * 0 days old, one from yesterday 1 day. Active ≤ 7, Recent 8–30, Quiet more
 * than 30 with no upper bound. No coverage means no Mention at all (CONTEXT.md).
 * A publication date slightly ahead of `now` (clock skew in a feed) counts as
 * today rather than failing the whole dashboard.
 */
export function mentionStatusOf(
  lastMentionAt: Date | null,
  now: Date,
  timeZone: string,
): MentionStatus {
  assertValidInstant(now, 'now');
  if (lastMentionAt === null) return 'no_coverage';
  assertValidInstant(lastMentionAt, 'lastMentionAt');
  const age = Math.max(
    0,
    daysBetween(calendarDateIn(lastMentionAt, timeZone), calendarDateIn(now, timeZone)),
  );
  if (age <= MENTION_STATUS_MAX_AGE_DAYS.active) return 'active';
  if (age <= MENTION_STATUS_MAX_AGE_DAYS.recent) return 'recent';
  return 'quiet';
}
