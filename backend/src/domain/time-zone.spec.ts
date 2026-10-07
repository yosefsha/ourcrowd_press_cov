import { calendarDateIn, daysBetween, InvalidTimeZone, isTimeZone, startOfDayIn } from './time-zone';

const JERUSALEM = 'Asia/Jerusalem';

describe('time-zone helpers', () => {
  it('knows IANA zones and rejects anything else', () => {
    expect(isTimeZone(JERUSALEM)).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isTimeZone('')).toBe(false);
  });

  it('reads the calendar day in the zone, not in UTC', () => {
    // 22:30 UTC on 30 Sep is already 1 Oct in Jerusalem (UTC+3 in summer).
    expect(calendarDateIn(new Date('2026-09-30T22:30:00Z'), JERUSALEM)).toEqual({ year: 2026, month: 10, day: 1 });
    expect(calendarDateIn(new Date('2026-09-30T22:30:00Z'), 'UTC')).toEqual({ year: 2026, month: 9, day: 30 });
  });

  it('finds local midnight in summer and winter time', () => {
    expect(startOfDayIn({ year: 2026, month: 10, day: 1 }, JERUSALEM).toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(startOfDayIn({ year: 2026, month: 1, day: 1 }, JERUSALEM).toISOString()).toBe('2025-12-31T22:00:00.000Z');
  });

  it('finds local midnight on DST transition days', () => {
    // Israel leaves summer time at 02:00 on 25 Oct 2026; midnight is still UTC+3.
    expect(startOfDayIn({ year: 2026, month: 10, day: 25 }, JERUSALEM).toISOString()).toBe('2026-10-24T21:00:00.000Z');
    expect(startOfDayIn({ year: 2026, month: 10, day: 26 }, JERUSALEM).toISOString()).toBe('2026-10-25T22:00:00.000Z');
    expect(startOfDayIn({ year: 2026, month: 3, day: 8 }, 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
  });

  it('counts whole calendar days, across month and year ends', () => {
    expect(daysBetween({ year: 2026, month: 12, day: 30 }, { year: 2027, month: 1, day: 2 })).toBe(3);
    expect(daysBetween({ year: 2026, month: 3, day: 2 }, { year: 2026, month: 3, day: 1 })).toBe(-1);
  });

  it('throws InvalidTimeZone for an unknown zone and RangeError for an invalid date', () => {
    expect(() => calendarDateIn(new Date(), 'Nowhere/City')).toThrow(InvalidTimeZone);
    expect(() => calendarDateIn(new Date('garbage'), JERUSALEM)).toThrow(RangeError);
  });
});
