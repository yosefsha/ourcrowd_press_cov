import { contiguousWeeklySeries } from './weekly-series';

const TIME_ZONE = 'Asia/Jerusalem';

describe('contiguousWeeklySeries', () => {
  it('covers every Monday-start week of the period without gaps, zero-filling missing weeks', () => {
    const series = contiguousWeeklySeries(
      { from: new Date('2026-09-30T21:00:00Z'), to: new Date('2026-10-20T10:00:00Z') },
      [{ weekStart: { year: 2026, month: 10, day: 12 }, sentiment: { positive: 1, negative: 2, neutral: 0 } }],
      TIME_ZONE,
    );

    expect(series).toEqual([
      { weekStart: '2026-09-28', sentiment: { positive: 0, negative: 0, neutral: 0 } },
      { weekStart: '2026-10-05', sentiment: { positive: 0, negative: 0, neutral: 0 } },
      { weekStart: '2026-10-12', sentiment: { positive: 1, negative: 2, neutral: 0 } },
      { weekStart: '2026-10-19', sentiment: { positive: 0, negative: 0, neutral: 0 } },
    ]);
  });

  it('places the exclusive end in the week of the instant before it', () => {
    // Monday 2026-10-05 00:00 in Jerusalem: the period ends on Sunday the 4th.
    const series = contiguousWeeklySeries(
      { from: new Date('2026-09-28T09:00:00Z'), to: new Date('2026-10-04T21:00:00Z') },
      [],
      TIME_ZONE,
    );

    expect(series.map((point) => point.weekStart)).toEqual(['2026-09-28']);
  });

  it('stays on Mondays across the end of daylight saving time', () => {
    const series = contiguousWeeklySeries(
      { from: new Date('2026-10-19T09:00:00Z'), to: new Date('2026-11-03T09:00:00Z') },
      [],
      TIME_ZONE,
    );

    expect(series.map((point) => point.weekStart)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
  });

  it('is empty for an empty period', () => {
    const instant = new Date('2026-10-01T00:00:00Z');
    expect(contiguousWeeklySeries({ from: instant, to: instant }, [], TIME_ZONE)).toEqual([]);
  });
});
