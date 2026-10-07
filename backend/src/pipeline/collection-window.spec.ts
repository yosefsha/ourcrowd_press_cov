import { backfillWindow, dailyCheckWindow, InvalidRunParams, isWithin } from './collection-window';

const JERUSALEM = 'Asia/Jerusalem';
const NOW = new Date('2026-07-31T12:00:00Z');

describe('backfillWindow', () => {
  it('is the rolling 90-day Coverage Window up to now without a cutoff', () => {
    expect(backfillWindow(null, NOW, JERUSALEM)).toEqual({ from: new Date('2026-05-02T12:00:00Z'), to: NOW });
  });

  it('ends at local midnight after the until day (inclusive cutoff)', () => {
    expect(backfillWindow('2026-07-23', NOW, JERUSALEM)).toEqual({
      from: new Date('2026-05-02T12:00:00Z'),
      to: new Date('2026-07-23T21:00:00Z'),
    });
  });

  it('crosses a month end', () => {
    expect(backfillWindow('2026-06-30', NOW, JERUSALEM).to).toEqual(new Date('2026-06-30T21:00:00Z'));
  });

  it('treats today or a future cutoff as now', () => {
    expect(backfillWindow('2026-07-31', NOW, JERUSALEM).to).toEqual(NOW);
    expect(backfillWindow('2027-01-01', NOW, JERUSALEM).to).toEqual(NOW);
  });

  it.each([['2026-02-30'], ['2026-7-1'], ['yesterday'], [''], ['2026-07-23T00:00:00Z']])('rejects until %j', (until) => {
    expect(() => backfillWindow(until, NOW, JERUSALEM)).toThrow(InvalidRunParams);
  });

  it('rejects a cutoff before the Coverage Window starts', () => {
    expect(() => backfillWindow('2026-04-30', NOW, JERUSALEM)).toThrow(/before the Coverage Window/);
  });
});

describe('dailyCheckWindow', () => {
  it('reaches seven days back when no Daily Check has succeeded', () => {
    expect(dailyCheckWindow(null, NOW, JERUSALEM)).toEqual({ from: new Date('2026-07-24T12:00:00Z'), to: NOW });
  });

  it('starts one day before the last successful Daily Check started', () => {
    expect(dailyCheckWindow(new Date('2026-07-30T04:00:00Z'), NOW, JERUSALEM)).toEqual({
      from: new Date('2026-07-29T04:00:00Z'),
      to: NOW,
    });
  });

  it('never reaches past the Coverage Window', () => {
    expect(dailyCheckWindow(new Date('2026-01-01T00:00:00Z'), NOW, JERUSALEM).from).toEqual(
      new Date('2026-05-02T12:00:00Z'),
    );
  });

  it('rejects an invalid now', () => {
    expect(() => dailyCheckWindow(null, new Date('nope'), JERUSALEM)).toThrow(RangeError);
  });
});

describe('isWithin', () => {
  const window = { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-07-02T00:00:00Z') };

  it('includes the start and excludes the end', () => {
    expect(isWithin(window.from, window)).toBe(true);
    expect(isWithin(window.to, window)).toBe(false);
    expect(isWithin(new Date('2026-06-30T23:59:59Z'), window)).toBe(false);
  });
});
