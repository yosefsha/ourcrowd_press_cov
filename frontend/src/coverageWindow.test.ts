import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COVERAGE_WINDOW,
  formatCoverageWindow,
  listCoverageWindows,
  parseCoverageWindow,
  previousQuarter,
  quarterOf,
  toQuarterKey,
} from './coverageWindow.ts';

// Local-time constructors: the selector works in the browser's time zone.
const OCT_7_2026 = new Date(2026, 9, 7, 12, 0, 0);

describe('quarterOf', () => {
  it.each([
    [new Date(2026, 0, 1), 1],
    [new Date(2026, 2, 31, 23, 59), 1],
    [new Date(2026, 3, 1), 2],
    [new Date(2026, 6, 15), 3],
    [new Date(2026, 11, 31, 23, 59), 4],
  ])('places %s in Q%i', (date, quarter) => {
    expect(quarterOf(date)).toEqual({ year: 2026, quarter });
  });
});

describe('previousQuarter', () => {
  it('steps back within a year', () => {
    expect(previousQuarter({ year: 2026, quarter: 4 })).toEqual({ year: 2026, quarter: 3 });
  });

  it('crosses the year boundary', () => {
    expect(previousQuarter({ year: 2026, quarter: 1 })).toEqual({ year: 2025, quarter: 4 });
    expect(previousQuarter({ year: 2026, quarter: 2 }, 6)).toEqual({ year: 2024, quarter: 4 });
  });

  it('returns the same quarter for a count of zero', () => {
    expect(previousQuarter({ year: 2026, quarter: 2 }, 0)).toEqual({ year: 2026, quarter: 2 });
  });
});

describe('parseCoverageWindow', () => {
  it('accepts the rolling window and well-formed quarters', () => {
    expect(parseCoverageWindow('rolling90')).toBe('rolling90');
    expect(parseCoverageWindow('2026-Q3')).toBe('2026-Q3');
  });

  it.each([null, undefined, '', 'rolling30', '2026-Q5', '2026-Q0', '2026Q3', '26-Q1', ' 2026-Q1', '2026-q1'])(
    'rejects %j',
    (value) => {
      expect(parseCoverageWindow(value)).toBeNull();
    },
  );
});

describe('formatCoverageWindow', () => {
  it('labels the rolling window', () => {
    expect(formatCoverageWindow('rolling90', OCT_7_2026)).toBe('Last 90 days');
  });

  it('marks the current quarter as to date', () => {
    expect(formatCoverageWindow('2026-Q4', OCT_7_2026)).toBe('Q4 2026 (to date)');
  });

  it('labels a completed quarter plainly', () => {
    expect(formatCoverageWindow('2026-Q3', OCT_7_2026)).toBe('Q3 2026');
  });
});

describe('listCoverageWindows', () => {
  it('offers the rolling window, the current quarter to date, then previous quarters newest first', () => {
    expect(listCoverageWindows(OCT_7_2026)).toEqual([
      { value: 'rolling90', label: 'Last 90 days' },
      { value: '2026-Q4', label: 'Q4 2026 (to date)' },
      { value: '2026-Q3', label: 'Q3 2026' },
      { value: '2026-Q2', label: 'Q2 2026' },
      { value: '2026-Q1', label: 'Q1 2026' },
      { value: '2025-Q4', label: 'Q4 2025' },
    ]);
  });

  it('starts with the default window', () => {
    expect(listCoverageWindows(OCT_7_2026)[0]?.value).toBe(DEFAULT_COVERAGE_WINDOW);
  });

  it('crosses into the previous year early in the year', () => {
    const values = listCoverageWindows(new Date(2027, 0, 2), 2).map((option) => option.value);
    expect(values).toEqual(['rolling90', '2027-Q1', '2026-Q4', '2026-Q3']);
  });

  it('can offer only the current quarter', () => {
    expect(listCoverageWindows(OCT_7_2026, 0).map((option) => option.value)).toEqual(['rolling90', '2026-Q4']);
  });

  it.each([-1, 1.5, Number.NaN])('rejects %s previous quarters', (count) => {
    expect(() => listCoverageWindows(OCT_7_2026, count)).toThrow(RangeError);
  });

  it('produces keys that parse back to themselves', () => {
    for (const option of listCoverageWindows(OCT_7_2026)) {
      expect(parseCoverageWindow(option.value)).toBe(option.value);
    }
    expect(toQuarterKey({ year: 2026, quarter: 1 })).toBe('2026-Q1');
  });
});
