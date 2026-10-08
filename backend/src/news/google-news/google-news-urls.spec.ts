import { recordedFeeds } from '../../../test/fixtures/google-news/recorded-google-news';
import type { CompanyProfile } from '../../domain/company';
import { parseNewsEdition } from '../../domain/news-edition';
import {
  buildArticlePageUrl,
  buildSearchQuery,
  buildSearchUrl,
  editionParameters,
  extractGoogleArticleId,
  searchTermsFor,
} from './google-news-urls';

const Q3 = { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-10-01T00:00:00Z') };
const ID =
  'CBMilgFBVV95cUxPZG9FMnV3UDlJUERkTEdTeU5WY0k1Uy1XTHNBWlF4TDI2R0oxUUJlSzZSanVweUVjLTlET21zWnBsVVNaMktjZVBaQXRidjJ5RGpteXF0OVpwb0JRMmp6SEtuOUJKRWZCM25WOWlrTGpfOWJtNWdRTFltNWFSbHRSRklINEN2MnYzdnVXRW04MDVTSTliZkE';

function profile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return { displayName: 'Stripe', aliases: [], domain: null, description: null, searchTerms: [], ...overrides };
}

describe('editionParameters', () => {
  it('builds the en-US edition', () => {
    expect(editionParameters(parseNewsEdition('en-US'))).toEqual({ hl: 'en-US', gl: 'US', ceid: 'US:en' });
  });

  it('builds the he-IL edition with the bare language as hl', () => {
    expect(editionParameters(parseNewsEdition('he-IL'))).toEqual({ hl: 'he', gl: 'IL', ceid: 'IL:he' });
  });
});

describe('searchTermsFor', () => {
  it('quotes the display name when there is nothing else', () => {
    expect(searchTermsFor(profile())).toEqual(['"Stripe"']);
  });

  it('adds each alias quoted, dropping blanks, duplicates and stray quotes', () => {
    expect(
      searchTermsFor(profile({ displayName: 'Island', aliases: ['איילנד', ' ', 'island', 'Island "Tech"'] })),
    ).toEqual(['"Island"', '"איילנד"', '"Island Tech"']);
  });

  it('uses curated Search Terms verbatim instead of the names', () => {
    expect(
      searchTermsFor(profile({ displayName: 'Harvey', aliases: ['Counsel AI'], searchTerms: ['"Harvey" AI legal', ''] })),
    ).toEqual(['"Harvey" AI legal']);
  });
});

describe('buildSearchQuery', () => {
  it('widens the window by a day on each side', () => {
    expect(buildSearchQuery(profile(), Q3)).toBe('"Stripe" after:2026-06-30 before:2026-10-02');
  });

  it('ORs several terms, parenthesising multi-word ones', () => {
    const query = buildSearchQuery(
      profile({ displayName: 'Harvey', searchTerms: ['"Harvey" AI legal', '"Harvey AI"', 'HarveyAI'] }),
      Q3,
    );
    expect(query).toBe('(("Harvey" AI legal) OR "Harvey AI" OR HarveyAI) after:2026-06-30 before:2026-10-02');
  });

  it('rejects an empty or inverted window', () => {
    expect(() => buildSearchQuery(profile(), { from: Q3.to, to: Q3.from })).toThrow(RangeError);
    expect(() => buildSearchQuery(profile(), { from: Q3.from, to: Q3.from })).toThrow(RangeError);
  });

  it('rejects a profile with nothing to search for', () => {
    expect(() => buildSearchQuery(profile({ displayName: '  ' }), Q3)).toThrow(RangeError);
  });
});

describe('buildSearchUrl', () => {
  it('builds the RSS search URL on news.google.com for the edition', () => {
    const url = buildSearchUrl('"Stripe" after:2026-06-30 before:2026-10-02', parseNewsEdition('he-IL'));
    expect(url.origin).toBe('https://news.google.com');
    expect(url.pathname).toBe('/rss/search');
    expect(url.searchParams.get('q')).toBe('"Stripe" after:2026-06-30 before:2026-10-02');
    expect(url.searchParams.get('hl')).toBe('he');
    expect(url.searchParams.get('gl')).toBe('IL');
    expect(url.searchParams.get('ceid')).toBe('IL:he');
  });

  it.each(recordedFeeds().map((feed) => [feed.file, feed] as const))(
    'matches the URL the %s fixture was recorded from',
    (_file, feed) => {
      expect(buildSearchUrl(buildSearchQuery(feed.profile, feed.window), feed.edition).href).toBe(feed.url);
    },
  );
});

describe('extractGoogleArticleId', () => {
  it('extracts the token of an RSS article link, ignoring the query', () => {
    expect(extractGoogleArticleId(`https://news.google.com/rss/articles/${ID}?oc=5`)).toBe(ID);
  });

  it.each([
    ['another host', `https://evil.example/rss/articles/${ID}`],
    ['plain http', `http://news.google.com/rss/articles/${ID}`],
    ['another path', `https://news.google.com/rss/search/${ID}`],
    ['a too-short token', 'https://news.google.com/rss/articles/CBMi'],
    ['not a URL', 'CBMi'],
  ])('returns null for %s', (_case, link) => {
    expect(extractGoogleArticleId(link)).toBeNull();
  });
});

describe('buildArticlePageUrl', () => {
  it('builds the article page on news.google.com for the edition', () => {
    expect(buildArticlePageUrl(ID, parseNewsEdition('en-US')).href).toBe(
      `https://news.google.com/rss/articles/${ID}?hl=en-US&gl=US&ceid=US%3Aen`,
    );
  });

  it('refuses anything that is not an article ID', () => {
    expect(() => buildArticlePageUrl('../../evil', parseNewsEdition('en-US'))).toThrow(RangeError);
  });
});
