import { describe, expect, it } from 'vitest';

import {
  describeLastMention,
  describeSentiment,
  formatDaysAgo,
  formatMentionCount,
  toSafeHttpUrl,
} from './coverageFormat.ts';

const now = new Date('2026-10-07T12:00:00.000Z');

describe('formatDaysAgo', () => {
  it.each([
    ['2026-10-07T08:00:00.000Z', 'today'],
    ['2026-10-06T08:00:00.000Z', 'yesterday'],
    ['2026-10-04T12:00:00.000Z', '3 days ago'],
  ])('describes %s as %s', (at, expected) => {
    expect(formatDaysAgo(at, now)).toBe(expected);
  });

  it('never describes a timestamp ahead of the clock as in the future', () => {
    expect(formatDaysAgo('2026-10-09T12:00:00.000Z', now)).toBe('today');
  });
});

describe('describeLastMention', () => {
  it('says how long ago the last Mention was', () => {
    expect(describeLastMention('2026-10-04T12:00:00.000Z', now, '2026-07-09T12:00:00.000Z')).toBe('3 days ago');
  });

  it('says since when nothing was found for a company never mentioned', () => {
    expect(describeLastMention(null, now, '2026-07-09T12:00:00.000Z')).toBe('No coverage found since Jul 9, 2026');
  });

  it('omits the date when it is not known', () => {
    expect(describeLastMention(null, now, null)).toBe('No coverage found');
  });
});

describe('formatMentionCount', () => {
  it('marks a capped count with a plus', () => {
    expect(formatMentionCount(100, true)).toBe('100+');
    expect(formatMentionCount(12, false)).toBe('12');
  });
});

describe('describeSentiment', () => {
  it('lists every Sentiment', () => {
    expect(describeSentiment({ positive: 3, negative: 1, neutral: 0 })).toBe('3 positive, 1 negative, 0 neutral');
  });
});

describe('toSafeHttpUrl', () => {
  it('keeps http and https links', () => {
    expect(toSafeHttpUrl('https://news.example.com/a')).toBe('https://news.example.com/a');
    expect(toSafeHttpUrl('http://news.example.com/a')).toBe('http://news.example.com/a');
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', '/relative', 'not a url'])('drops %s', (url) => {
    expect(toSafeHttpUrl(url)).toBeNull();
  });
});
