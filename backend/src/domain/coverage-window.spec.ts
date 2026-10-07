import {
  type CoverageWindow,
  CoverageWindowInFuture,
  formatCoverageWindow,
  InvalidCoverageWindow,
  parseCoverageWindow,
  quarterContaining,
  resolveCoverageWindow,
} from './coverage-window';
import { InvalidTimeZone } from './time-zone';

const JERUSALEM = 'Asia/Jerusalem';
const NOW = new Date('2026-10-07T09:00:00Z');

describe('parseCoverageWindow / formatCoverageWindow', () => {
  it.each([
    ['rolling90', { kind: 'rolling' }],
    ['2026-Q3', { kind: 'quarter', year: 2026, quarter: 3 }],
    ['1999-Q1', { kind: 'quarter', year: 1999, quarter: 1 }],
  ])('parses %s and formats it back', (value, expected) => {
    const window = parseCoverageWindow(value);

    expect(window).toEqual(expected);
    expect(formatCoverageWindow(window)).toBe(value);
  });

  it.each([
    [''],
    ['rolling30'],
    ['Rolling90'],
    ['2026-Q0'],
    ['2026-Q5'],
    ['2026-q3'],
    ['26-Q3'],
    ['2026Q3'],
    [' 2026-Q3'],
    ['2026-Q3 '],
    ['2026-Q3; DROP TABLE runs'],
  ])('rejects %j', (value) => {
    expect(() => parseCoverageWindow(value)).toThrow(InvalidCoverageWindow);
  });
});

describe('resolveCoverageWindow', () => {
  it('resolves rolling90 to the 90 days before now', () => {
    expect(resolveCoverageWindow({ kind: 'rolling' }, NOW, JERUSALEM)).toEqual({
      from: new Date('2026-07-09T09:00:00Z'),
      to: NOW,
    });
  });

  it('resolves a past quarter to local midnight boundaries', () => {
    // Q3 2026 in Jerusalem: 1 Jul 00:00 IDT to 1 Oct 00:00 IDT.
    expect(resolveCoverageWindow(parseCoverageWindow('2026-Q3'), NOW, JERUSALEM)).toEqual({
      from: new Date('2026-06-30T21:00:00Z'),
      to: new Date('2026-09-30T21:00:00Z'),
    });
  });

  it('resolves Q4 across the year end, in winter time', () => {
    expect(resolveCoverageWindow(parseCoverageWindow('2025-Q4'), NOW, JERUSALEM)).toEqual({
      from: new Date('2025-09-30T21:00:00Z'),
      to: new Date('2025-12-31T22:00:00Z'),
    });
  });

  it('ends the current quarter at now (to date)', () => {
    expect(resolveCoverageWindow(parseCoverageWindow('2026-Q4'), NOW, JERUSALEM)).toEqual({
      from: new Date('2026-09-30T21:00:00Z'),
      to: NOW,
    });
  });

  it('treats the quarter as current from its local midnight, even while UTC is still in the previous one', () => {
    const justAfterLocalMidnight = new Date('2026-09-30T21:30:00Z');

    expect(resolveCoverageWindow(parseCoverageWindow('2026-Q4'), justAfterLocalMidnight, JERUSALEM).to).toEqual(
      justAfterLocalMidnight,
    );
    expect(() =>
      resolveCoverageWindow(parseCoverageWindow('2026-Q4'), justAfterLocalMidnight, 'UTC'),
    ).toThrow(CoverageWindowInFuture);
  });

  it.each([['2027-Q1'], ['2026-Q4']])('rejects %s when it has not started yet', (value) => {
    const window: CoverageWindow = parseCoverageWindow(value);

    expect(() => resolveCoverageWindow(window, new Date('2026-09-01T00:00:00Z'), JERUSALEM)).toThrow(
      CoverageWindowInFuture,
    );
  });

  it('rejects an invalid now and an unknown time zone', () => {
    expect(() => resolveCoverageWindow({ kind: 'rolling' }, new Date(Number.NaN), JERUSALEM)).toThrow(RangeError);
    expect(() => resolveCoverageWindow(parseCoverageWindow('2026-Q1'), NOW, 'Nowhere/City')).toThrow(InvalidTimeZone);
  });
});

describe('quarterContaining', () => {
  it('uses the local calendar', () => {
    expect(quarterContaining(new Date('2026-09-30T21:30:00Z'), JERUSALEM)).toEqual({
      kind: 'quarter',
      year: 2026,
      quarter: 4,
    });
    expect(quarterContaining(new Date('2026-09-30T21:30:00Z'), 'UTC')).toEqual({
      kind: 'quarter',
      year: 2026,
      quarter: 3,
    });
  });
});
