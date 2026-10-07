import type { DateRange } from '../domain/date-range';
import { calendarDateIn, type CalendarDate } from '../domain/time-zone';
import type { SentimentCounts, WeeklyMentionCount } from './coverage-read-model';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

/** A week of the series: its Monday and its Mentions per Sentiment. */
export interface WeeklySentimentPoint {
  /** `YYYY-MM-DD`. */
  readonly weekStart: string;
  readonly sentiment: SentimentCounts;
}

const NO_MENTIONS: SentimentCounts = { positive: 0, negative: 0, neutral: 0 };

function toEpochDay(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;
}

function formatEpochDay(epochDay: number): string {
  return new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The Monday on or before `epochDay` (1970-01-01 was a Thursday). */
function mondayOnOrBefore(epochDay: number): number {
  const daysSinceMonday = (((epochDay + 3) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return epochDay - daysSinceMonday;
}

/**
 * Every week overlapping `period`, oldest first and without gaps, each starting
 * on Monday in `timeZone`; weeks missing from `counts` are zeros. Counts for a
 * week outside the period are ignored.
 */
export function contiguousWeeklySeries(
  period: DateRange,
  counts: readonly WeeklyMentionCount[],
  timeZone: string,
): WeeklySentimentPoint[] {
  if (period.to.getTime() <= period.from.getTime()) return [];
  const byWeek = new Map<number, SentimentCounts>();
  for (const count of counts) {
    byWeek.set(mondayOnOrBefore(toEpochDay(count.weekStart)), count.sentiment);
  }
  const first = mondayOnOrBefore(toEpochDay(calendarDateIn(period.from, timeZone)));
  // `to` is exclusive: the last instant inside the period is one millisecond earlier.
  const last = mondayOnOrBefore(toEpochDay(calendarDateIn(new Date(period.to.getTime() - 1), timeZone)));
  const series: WeeklySentimentPoint[] = [];
  for (let week = first; week <= last; week += DAYS_PER_WEEK) {
    series.push({ weekStart: formatEpochDay(week), sentiment: byWeek.get(week) ?? NO_MENTIONS });
  }
  return series;
}
