import type { DateRange } from './date-range';
import { assertValidInstant, calendarDateIn, startOfDayIn } from './time-zone';

export type QuarterNumber = 1 | 2 | 3 | 4;

/** Length of the rolling Coverage Window, the dashboard's default. */
export const ROLLING_WINDOW_DAYS = 90;

/** The rolling window's spelling on the API (`?window=rolling90`). */
export const ROLLING_WINDOW_KEY = `rolling${ROLLING_WINDOW_DAYS}`;

/**
 * The period of Mentions the dashboard shows: the rolling last 90 days, or a
 * calendar quarter (the current quarter means "to date").
 */
export type CoverageWindow =
  | { readonly kind: 'rolling' }
  | { readonly kind: 'quarter'; readonly year: number; readonly quarter: QuarterNumber };

export class InvalidCoverageWindow extends Error {
  constructor(readonly value: string) {
    super(`Not a Coverage Window: "${value}" (expected ${ROLLING_WINDOW_KEY} or YYYY-Qn)`);
    this.name = 'InvalidCoverageWindow';
  }
}

export class CoverageWindowInFuture extends Error {
  constructor(readonly window: CoverageWindow) {
    super(`Coverage Window ${formatCoverageWindow(window)} has not started yet`);
    this.name = 'CoverageWindowInFuture';
  }
}

const QUARTER_PATTERN = /^(\d{4})-Q([1-4])$/;
const MS_PER_DAY = 86_400_000;

/** Parses the API spelling: `rolling90` or a quarter such as `2026-Q3`. */
export function parseCoverageWindow(value: string): CoverageWindow {
  if (value === ROLLING_WINDOW_KEY) return { kind: 'rolling' };
  const match = QUARTER_PATTERN.exec(value);
  if (match === null) throw new InvalidCoverageWindow(value);
  return { kind: 'quarter', year: Number(match[1]), quarter: Number(match[2]) as QuarterNumber };
}

/** The API spelling of a Coverage Window — the inverse of `parseCoverageWindow`. */
export function formatCoverageWindow(window: CoverageWindow): string {
  return window.kind === 'rolling'
    ? ROLLING_WINDOW_KEY
    : `${String(window.year).padStart(4, '0')}-Q${window.quarter}`;
}

/**
 * The half-open period a Coverage Window covers as of `now`. Quarters begin at
 * midnight in `timeZone`; the current quarter ends at `now` (to date). A quarter
 * that has not started yet is rejected with `CoverageWindowInFuture`.
 */
export function resolveCoverageWindow(
  window: CoverageWindow,
  now: Date,
  timeZone: string,
): DateRange {
  assertValidInstant(now, 'now');
  if (window.kind === 'rolling') {
    return { from: new Date(now.getTime() - ROLLING_WINDOW_DAYS * MS_PER_DAY), to: now };
  }
  const firstMonth = (window.quarter - 1) * 3 + 1;
  const from = startOfDayIn({ year: window.year, month: firstMonth, day: 1 }, timeZone);
  if (from.getTime() > now.getTime()) throw new CoverageWindowInFuture(window);
  const next =
    window.quarter === 4
      ? { year: window.year + 1, month: 1, day: 1 }
      : { year: window.year, month: firstMonth + 3, day: 1 };
  const end = startOfDayIn(next, timeZone);
  return { from, to: end.getTime() < now.getTime() ? end : now };
}

/** The calendar quarter containing `instant` in `timeZone`. */
export function quarterContaining(instant: Date, timeZone: string): CoverageWindow {
  const { year, month } = calendarDateIn(instant, timeZone);
  return { kind: 'quarter', year, quarter: (Math.floor((month - 1) / 3) + 1) as QuarterNumber };
}
