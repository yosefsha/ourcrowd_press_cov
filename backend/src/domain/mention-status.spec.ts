import { mentionStatusOf } from './mention-status';

const JERUSALEM = 'Asia/Jerusalem';
// 12:00 local (IDT, UTC+3) on 7 Oct 2026.
const NOW = new Date('2026-10-07T09:00:00Z');

function daysAgo(days: number, hourUtc = 9): Date {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hourUtc);
  return date;
}

describe('mentionStatusOf', () => {
  it('is no_coverage without any Mention', () => {
    expect(mentionStatusOf(null, NOW, JERUSALEM)).toBe('no_coverage');
  });

  it.each([
    [0, 'active'],
    [7, 'active'],
    [8, 'recent'],
    [30, 'recent'],
    [31, 'quiet'],
    [90, 'quiet'],
    [91, 'no_coverage'],
    [400, 'no_coverage'],
  ] as const)('a Mention %i calendar days ago is %s', (days, expected) => {
    expect(mentionStatusOf(daysAgo(days), NOW, JERUSALEM)).toBe(expected);
  });

  it('counts calendar days in the configured zone, not elapsed hours', () => {
    // 21:30 UTC eight days back is 00:30 local seven days back: still Active.
    expect(mentionStatusOf(daysAgo(8, 21), NOW, JERUSALEM)).toBe('active');
    expect(mentionStatusOf(daysAgo(8, 21), NOW, 'UTC')).toBe('recent');
  });

  it('counts a publication date in the future (feed clock skew) as active', () => {
    expect(mentionStatusOf(new Date('2026-10-08T09:00:00Z'), NOW, JERUSALEM)).toBe('active');
  });

  it('rejects invalid dates', () => {
    expect(() => mentionStatusOf(new Date('nope'), NOW, JERUSALEM)).toThrow(RangeError);
    expect(() => mentionStatusOf(daysAgo(1), new Date('nope'), JERUSALEM)).toThrow(RangeError);
  });
});
