/** A day on the calendar of some time zone. `month` is 1–12. */
export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export class InvalidTimeZone extends Error {
  constructor(readonly timeZone: string) {
    super(`Not an IANA time zone: "${timeZone}"`);
    this.name = 'InvalidTimeZone';
  }
}

const MS_PER_DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    } catch {
      throw new InvalidTimeZone(timeZone);
    }
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** True when `timeZone` is an IANA zone the runtime knows (e.g. `Asia/Jerusalem`). */
export function isTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Throws a RangeError when `instant` is an Invalid Date. */
export function assertValidInstant(instant: Date, label: string): void {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`${label} is not a valid date`);
  }
}

/** The wall-clock fields of `instant` in `timeZone`, as if they were UTC — in ms. */
function wallClockAsUtc(instant: Date, timeZone: string): number {
  const fields: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value);
  }
  return Date.UTC(
    fields.year ?? 0,
    (fields.month ?? 1) - 1,
    fields.day ?? 1,
    fields.hour ?? 0,
    fields.minute ?? 0,
    fields.second ?? 0,
  );
}

/** The calendar day `instant` falls on in `timeZone`. */
export function calendarDateIn(instant: Date, timeZone: string): CalendarDate {
  assertValidInstant(instant, 'instant');
  const wall = new Date(wallClockAsUtc(instant, timeZone));
  return { year: wall.getUTCFullYear(), month: wall.getUTCMonth() + 1, day: wall.getUTCDate() };
}

/** The instant the calendar day `date` begins in `timeZone` (handles DST offsets). */
export function startOfDayIn(date: CalendarDate, timeZone: string): Date {
  const wallMidnight = Date.UTC(date.year, date.month - 1, date.day);
  let instant = wallMidnight;
  // Two passes settle the offset even when `date` is a DST transition day.
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = wallClockAsUtc(new Date(instant), timeZone) - instant;
    instant = wallMidnight - offset;
  }
  return new Date(instant);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const start = Date.UTC(from.year, from.month - 1, from.day);
  const end = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((end - start) / MS_PER_DAY);
}
