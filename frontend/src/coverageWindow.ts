import type { CoverageWindow, QuarterKey, QuarterNumber } from './types.ts';

/** The Coverage Window the dashboard opens on (CONTEXT.md). */
export const DEFAULT_COVERAGE_WINDOW: CoverageWindow = 'rolling90';

/** How many completed quarters the selector offers after the current one. */
export const DEFAULT_PREVIOUS_QUARTERS = 4;

export interface Quarter {
  readonly year: number;
  readonly quarter: QuarterNumber;
}

export interface CoverageWindowOption {
  readonly value: CoverageWindow;
  readonly label: string;
}

const QUARTER_KEY_PATTERN = /^(\d{4})-Q([1-4])$/;

/** The calendar quarter containing `date`, in the browser's local time zone. */
export function quarterOf(date: Date): Quarter {
  return { year: date.getFullYear(), quarter: toQuarterNumber(Math.floor(date.getMonth() / 3) + 1) };
}

/** The quarter `count` quarters before `quarter` (negative counts move forward). */
export function previousQuarter(quarter: Quarter, count = 1): Quarter {
  const index = quarter.year * 4 + (quarter.quarter - 1) - count;
  return { year: Math.floor(index / 4), quarter: toQuarterNumber((((index % 4) + 4) % 4) + 1) };
}

export function toQuarterKey(quarter: Quarter): QuarterKey {
  return `${quarter.year}-Q${quarter.quarter}`;
}

/** Parses an untrusted value (e.g. a URL parameter); null when it is not a Coverage Window. */
export function parseCoverageWindow(value: string | null | undefined): CoverageWindow | null {
  if (value === 'rolling90') return value;
  if (value === null || value === undefined) return null;
  const match = QUARTER_KEY_PATTERN.exec(value);
  if (match === null) return null;
  return toQuarterKey({ year: Number(match[1]), quarter: toQuarterNumber(Number(match[2])) });
}

/** Human label for a Coverage Window; the quarter containing `now` reads "to date". */
export function formatCoverageWindow(window: CoverageWindow, now: Date): string {
  if (window === 'rolling90') return 'Last 90 days';
  const quarter = parseQuarterKey(window);
  const label = `Q${quarter.quarter} ${quarter.year}`;
  return toQuarterKey(quarterOf(now)) === window ? `${label} (to date)` : label;
}

/**
 * The windows the selector offers, most useful first: the rolling 90 days,
 * the current quarter to date, then `previousQuarters` completed quarters,
 * newest first.
 */
export function listCoverageWindows(
  now: Date,
  previousQuarters: number = DEFAULT_PREVIOUS_QUARTERS,
): readonly CoverageWindowOption[] {
  if (!Number.isInteger(previousQuarters) || previousQuarters < 0) {
    throw new RangeError(`previousQuarters must be a non-negative integer, got ${previousQuarters}`);
  }
  const current = quarterOf(now);
  const quarters = Array.from({ length: previousQuarters + 1 }, (_, offset) => previousQuarter(current, offset));
  const windows: CoverageWindow[] = [DEFAULT_COVERAGE_WINDOW, ...quarters.map(toQuarterKey)];
  return windows.map((value) => ({ value, label: formatCoverageWindow(value, now) }));
}

function parseQuarterKey(key: QuarterKey): Quarter {
  const match = QUARTER_KEY_PATTERN.exec(key);
  if (match === null) throw new RangeError(`Not a quarter key: ${key}`);
  return { year: Number(match[1]), quarter: toQuarterNumber(Number(match[2])) };
}

function toQuarterNumber(value: number): QuarterNumber {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  throw new RangeError(`Not a quarter number: ${value}`);
}
