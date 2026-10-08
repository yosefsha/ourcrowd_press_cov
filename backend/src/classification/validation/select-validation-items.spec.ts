import { parseGoogleNewsRss } from '../../news/google-news/google-news-rss-parser';
import { recordedFeed } from '../../../test/fixtures/google-news/recorded-google-news';
import { pickEvenly, selectValidationItems, type FeedSelection } from './select-validation-items';

function selection(file: string, pick: number): FeedSelection {
  const feed = recordedFeed(file);
  return {
    sourceFeed: `google-news/${file}`,
    nameKind: 'ambiguous',
    pick,
    profile: feed.profile,
    window: feed.window,
    articles: parseGoogleNewsRss(feed.xml, feed.edition).articles,
  };
}

describe('pickEvenly', () => {
  it('spreads the picks over the whole list, starting with the first', () => {
    expect(pickEvenly([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([0, 2, 5, 7]);
    expect(pickEvenly(['a', 'b', 'c'], 1)).toEqual(['a']);
  });

  it('returns every item when there are no more than asked for', () => {
    expect(pickEvenly([1, 2], 5)).toEqual([1, 2]);
    expect(pickEvenly([], 3)).toEqual([]);
  });

  it('rejects a negative or fractional count', () => {
    expect(() => pickEvenly([1], -1)).toThrow(RangeError);
    expect(() => pickEvenly([1], 1.5)).toThrow(RangeError);
  });
});

describe('selectValidationItems (recorded Google News feeds)', () => {
  it('takes in-window Candidates that name the company, with readable ids', () => {
    const feed = selection('harvey.en-US.xml', 4);

    const { items, shortfalls } = selectValidationItems([feed]);

    expect(shortfalls).toEqual([]);
    expect(items.map((item) => item.id)).toEqual(['harvey-en-01', 'harvey-en-02', 'harvey-en-03', 'harvey-en-04']);
    for (const item of items) {
      expect(item.company).toEqual(feed.profile);
      expect(item.article.title.toLowerCase()).toContain('harvey');
      expect(item.article.publishedAt.getTime()).toBeGreaterThanOrEqual(feed.window.from.getTime());
      expect(item.article.publishedAt.getTime()).toBeLessThan(feed.window.to.getTime());
      expect(item.article.url.startsWith('https://news.google.com/rss/articles/')).toBe(true);
      expect(item.article).toMatchObject({ edition: 'en-US', language: 'en' });
    }
  });

  it('labels Hebrew-edition items with the Hebrew language', () => {
    const { items } = selectValidationItems([selection('island.he-IL.xml', 2)]);

    expect(items.map((item) => item.id)).toEqual(['island-he-01', 'island-he-02']);
    expect(items.every((item) => item.article.language === 'he')).toBe(true);
  });

  it('never picks the same article twice for a company', () => {
    const { items } = selectValidationItems([selection('harvey.en-US.xml', 100), selection('harvey.en-US.xml', 100)]);

    const keys = items.map((item) => item.article.url);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reports a feed that cannot supply what was asked', () => {
    const { items, shortfalls } = selectValidationItems([selection('siteaware.en-US.xml', 2)]);

    expect(items).toEqual([]);
    expect(shortfalls).toEqual([{ sourceFeed: 'google-news/siteaware.en-US.xml', wanted: 2, eligible: 0 }]);
  });
});
