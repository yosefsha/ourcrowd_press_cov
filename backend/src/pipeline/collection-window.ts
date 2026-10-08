import { resolveCoverageWindow } from '../domain/coverage-window';
import type { DateRange } from '../domain/date-range';
import type { IsoDate } from '../domain/run';
import { assertValidInstant, type CalendarDate, startOfDayIn } from '../domain/time-zone';

const MS_PER_DAY = 86_400_000;

/** How far back a Daily Check reaches when no earlier Daily Check succeeded. */
export const FIRST_DAILY_CHECK_LOOKBACK_DAYS = 7;
/** Overlap with the previous successful Daily Check, for articles the feed lists late. */
export const DAILY_CHECK_OVERLAP_DAYS = 1;

/** A Run's parameters cannot be executed as given. */
export class InvalidRunParams extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRunParams';
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day after `value`, a `YYYY-MM-DD` date. Throws `InvalidRunParams`. */
function dayAfter(value: IsoDate): CalendarDate {
  const match = ISO_DATE.exec(value);
  const date = match === null ? null : new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date === null || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidRunParams(`until must be a calendar date (YYYY-MM-DD), got "${value}"`);
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * The Backfill's publication window: the rolling Coverage Window as of `now`,
 * cut off at the end of the `until` day (inclusive, in `timeZone`) when given.
 * A cutoff in the future means "up to now"; one before the Coverage Window
 * starts leaves nothing to collect and is rejected.
 */
export function backfillWindow(until: IsoDate | null, now: Date, timeZone: string): DateRange {
  const coverage = resolveCoverageWindow({ kind: 'rolling' }, now, timeZone);
  if (until === null) return coverage;
  const cutoff = startOfDayIn(dayAfter(until), timeZone);
  if (cutoff.getTime() <= coverage.from.getTime()) {
    throw new InvalidRunParams(`until ${until} is before the Coverage Window starts`);
  }
  return { from: coverage.from, to: cutoff.getTime() < now.getTime() ? cutoff : now };
}

/**
 * The Daily Check's publication window: from one day before the start of the
 * last successful Daily Check (seven days back when there is none) to `now`,
 * never reaching further back than the Coverage Window.
 */
export function dailyCheckWindow(lastSuccessfulStart: Date | null, now: Date, timeZone: string): DateRange {
  assertValidInstant(now, 'now');
  const coverage = resolveCoverageWindow({ kind: 'rolling' }, now, timeZone);
  const from =
    lastSuccessfulStart === null
      ? new Date(now.getTime() - FIRST_DAILY_CHECK_LOOKBACK_DAYS * MS_PER_DAY)
      : new Date(lastSuccessfulStart.getTime() - DAILY_CHECK_OVERLAP_DAYS * MS_PER_DAY);
  return { from: from.getTime() < coverage.from.getTime() ? coverage.from : from, to: now };
}

/** True when `instant` lies inside the half-open `window`. */
export function isWithin(instant: Date, window: DateRange): boolean {
  const time = instant.getTime();
  return time >= window.from.getTime() && time < window.to.getTime();
}
