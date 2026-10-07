import { describe, expect, it } from 'vitest';

import {
  articleHref,
  candidateReason,
  formatMentionCount,
  formatPercent,
  isHighRejectionRate,
  pageCount,
  toWeeklyChartData,
} from './companyDetailData.ts';
import { buildMention, buildRejected } from '../test/companyDetailFixtures.ts';

describe('toWeeklyChartData', () => {
  it('returns no rows for an empty series', () => {
    expect(toWeeklyChartData([])).toEqual([]);
  });

  it('maps each week to a labelled row with its total', () => {
    expect(toWeeklyChartData([{ weekStart: '2026-10-05', positive: 2, negative: 1, neutral: 3 }])).toEqual([
      { weekStart: '2026-10-05', label: 'Oct 5', positive: 2, negative: 1, neutral: 3, total: 6 },
    ]);
  });

  it('sorts weeks and fills weeks without Mentions with zeros', () => {
    const rows = toWeeklyChartData([
      { weekStart: '2026-10-05', positive: 1, negative: 1, neutral: 0 },
      { weekStart: '2026-09-21', positive: 1, negative: 0, neutral: 0 },
    ]);
    expect(rows.map((row) => [row.weekStart, row.total])).toEqual([
      ['2026-09-21', 1],
      ['2026-09-28', 0],
      ['2026-10-05', 2],
    ]);
  });

  it('keeps the weekly step across a year boundary', () => {
    const rows = toWeeklyChartData([
      { weekStart: '2025-12-22', positive: 1, negative: 0, neutral: 0 },
      { weekStart: '2026-01-05', positive: 0, negative: 1, neutral: 0 },
    ]);
    expect(rows.map((row) => row.weekStart)).toEqual(['2025-12-22', '2025-12-29', '2026-01-05']);
  });

  it('rejects week starts that are not whole weeks apart instead of dropping them', () => {
    expect(() =>
      toWeeklyChartData([
        { weekStart: '2026-09-21', positive: 1, negative: 0, neutral: 0 },
        { weekStart: '2026-09-27', positive: 0, negative: 1, neutral: 0 },
      ]),
    ).toThrow(RangeError);
  });

  it('rejects a malformed week start', () => {
    expect(() => toWeeklyChartData([{ weekStart: '05/10/2026', positive: 1, negative: 0, neutral: 0 }])).toThrow(
      RangeError,
    );
  });
});

describe('articleHref', () => {
  const googleUrl = 'https://news.google.com/rss/articles/abc';

  it('prefers the publisher URL', () => {
    expect(articleHref({ publisherUrl: 'https://outlet.example/a', googleUrl })).toBe('https://outlet.example/a');
  });

  it('falls back to the Google News link while the publisher URL is unknown', () => {
    expect(articleHref({ publisherUrl: null, googleUrl })).toBe(googleUrl);
  });

  it('falls back to the Google News link when the publisher URL is not a web URL', () => {
    expect(articleHref({ publisherUrl: 'javascript:alert(1)', googleUrl })).toBe(googleUrl);
  });

  it('returns null when neither URL is usable', () => {
    expect(articleHref({ publisherUrl: null, googleUrl: 'not a url' })).toBeNull();
  });
});

describe('rejection rate', () => {
  it('flags a rate at or above the threshold', () => {
    expect(isHighRejectionRate(0.5)).toBe(true);
    expect(isHighRejectionRate(0.49)).toBe(false);
  });

  it('formats as a whole percentage', () => {
    expect(formatPercent(0.256)).toBe('26%');
  });
});

describe('candidateReason', () => {
  it('uses the Sentiment reason for a Mention', () => {
    expect(candidateReason(buildMention({ sentimentReason: 'Upbeat' }))).toBe('Upbeat');
  });

  it('uses the Relevance reason for a rejected Candidate', () => {
    expect(candidateReason(buildRejected({ relevanceReason: 'Different Harvey' }))).toBe('Different Harvey');
  });
});

describe('formatting helpers', () => {
  it('marks a capped Mention count', () => {
    expect(formatMentionCount(100, true)).toBe('100+');
    expect(formatMentionCount(7, false)).toBe('7');
  });

  it('counts at least one page', () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(41, 20)).toBe(3);
  });
});
