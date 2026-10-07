import { describe, expect, it } from 'vitest';

import { articleHref, describeDigest, findUnseenDigests, orderDigestGroups } from './alertDigests.ts';
import { digestDetail, digestSummary, laterDigestSummary } from './test/alertsOperationsFixtures.tsx';

describe('orderDigestGroups', () => {
  it('puts companies with negative Mentions first and negatives first within each company', () => {
    const ordered = orderDigestGroups(digestDetail.companies);
    expect(ordered.map((group) => group.displayName)).toEqual(['OncoHost', 'ZutaCore']);
    expect(ordered[0]?.mentions.map((mention) => mention.sentiment)).toEqual(['negative', 'neutral']);
  });

  it('keeps the server order among companies without negatives', () => {
    const groups = digestDetail.companies.map((group) => ({
      ...group,
      mentions: group.mentions.filter((mention) => mention.sentiment !== 'negative'),
    }));
    expect(orderDigestGroups(groups).map((group) => group.displayName)).toEqual(['ZutaCore', 'OncoHost']);
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(digestDetail.companies);
    orderDigestGroups(digestDetail.companies);
    expect(JSON.stringify(digestDetail.companies)).toBe(before);
  });
});

describe('articleHref', () => {
  it('prefers the publisher URL', () => {
    expect(articleHref({ publisherUrl: 'https://example.org/a', googleUrl: 'https://news.google.com/x' })).toBe(
      'https://example.org/a',
    );
  });

  it('falls back to the Google News link while the publisher URL is unknown', () => {
    expect(articleHref({ publisherUrl: null, googleUrl: 'https://news.google.com/x' })).toBe('https://news.google.com/x');
  });

  it('never returns a non-http(s) or malformed URL', () => {
    expect(articleHref({ publisherUrl: 'javascript:alert(1)', googleUrl: 'https://news.google.com/x' })).toBe(
      'https://news.google.com/x',
    );
    expect(articleHref({ publisherUrl: 'not a url', googleUrl: 'data:text/html,hi' })).toBeNull();
  });
});

describe('findUnseenDigests', () => {
  it('returns digests whose id has not been seen', () => {
    expect(findUnseenDigests(new Set([11]), [digestSummary, laterDigestSummary])).toEqual([laterDigestSummary]);
    expect(findUnseenDigests(new Set([11, 12]), [digestSummary, laterDigestSummary])).toEqual([]);
  });
});

describe('describeDigest', () => {
  it('pluralises', () => {
    expect(describeDigest(digestSummary)).toBe('3 New Mentions across 2 companies, 1 negative');
    expect(describeDigest(laterDigestSummary)).toBe('1 New Mention across 1 company, 0 negative');
  });
});
