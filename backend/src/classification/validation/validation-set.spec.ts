import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseNewsEdition } from '../../domain/news-edition';
import { parseGoogleNewsRss } from '../../news/google-news/google-news-rss-parser';
import { buildSearchQuery, buildSearchUrl } from '../../news/google-news/google-news-urls';
import { InvalidValidationSet, parseValidationSet, serializeValidationSet, toClassifiableArticle } from './validation-set';

const FIXTURES = join(__dirname, '..', '..', '..', 'test', 'fixtures');
const SET_PATH = join(FIXTURES, 'validation', 'validation-set.json');
const RAW: unknown = JSON.parse(readFileSync(SET_PATH, 'utf8'));
const SET = parseValidationSet(RAW, SET_PATH);

interface ManifestFeed {
  readonly file: string;
  readonly edition: string;
  readonly profile: Parameters<typeof buildSearchQuery>[0];
  readonly window: { readonly from: string; readonly to: string };
  readonly url: string;
}

function manifestFeeds(directory: string): readonly ManifestFeed[] {
  return (JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')) as { feeds: ManifestFeed[] }).feeds;
}

describe('parseValidationSet', () => {
  it('round-trips the committed set through its JSON form', () => {
    expect(parseValidationSet(JSON.parse(serializeValidationSet(SET)), 'again.json')).toEqual(SET);
  });

  it('gives the classifiers the article fields they read', () => {
    const [item] = SET.items;
    if (item === undefined) throw new Error('empty set');

    expect(toClassifiableArticle(item.article)).toEqual({
      title: item.article.title,
      snippet: item.article.snippet,
      outletName: item.article.outlet,
      publishedAt: item.article.publishedAt,
      language: item.article.language,
    });
  });

  it.each([
    ['a non-object', 'x', 'not a JSON object'],
    ['no builtAt', { items: [{}] }, 'builtAt is required'],
    ['no items', { builtAt: '2026-10-08T00:00:00Z', items: [] }, 'items must be a non-empty array'],
    ['a malformed item', { builtAt: '2026-10-08T00:00:00Z', items: [{ id: 'x' }] }, 'item 0 is malformed'],
  ])('rejects %s', (_case, json, problem) => {
    expect(() => parseValidationSet(json, 'bad.json')).toThrow(InvalidValidationSet);
    expect(() => parseValidationSet(json, 'bad.json')).toThrow(problem);
  });

  it('rejects a repeated id', () => {
    const [first] = (RAW as { items: unknown[] }).items;

    expect(() => parseValidationSet({ builtAt: '2026-10-08T00:00:00Z', items: [first, first] }, 'bad.json')).toThrow('is repeated');
  });
});

describe('the committed validation set (#18)', () => {
  it('has ~60 Candidates, mostly ambiguous names, ~10 from the Hebrew edition', () => {
    const hebrew = SET.items.filter((item) => item.article.language === 'he').length;
    const ambiguous = SET.items.filter((item) => item.nameKind === 'ambiguous').length;

    expect(SET.items.length).toBeGreaterThanOrEqual(55);
    expect(hebrew).toBeGreaterThanOrEqual(10);
    expect(ambiguous).toBeGreaterThan(SET.items.length / 2);
  });

  it('takes every item, unedited, from the recorded feed it names', () => {
    for (const item of SET.items) {
      const path = join(FIXTURES, item.sourceFeed);
      const feed = manifestFeeds(dirname(path)).find((entry) => entry.file === item.sourceFeed.split('/').pop());
      if (feed === undefined) throw new Error(`${item.sourceFeed} is not in its manifest`);
      const articles = parseGoogleNewsRss(readFileSync(path, 'utf8'), parseNewsEdition(feed.edition)).articles;
      const source = articles.find((article) => article.googleUrl === item.article.url);

      expect({ id: item.id, title: source?.title, outlet: source?.outletName, company: feed.profile }).toEqual({
        id: item.id,
        title: item.article.title,
        outlet: item.article.outlet,
        company: item.company,
      });
    }
  });
});

describe('the recorded validation feeds', () => {
  const directory = join(FIXTURES, 'validation', 'feeds');

  it.each(manifestFeeds(directory).map((feed) => [feed.file, feed] as const))(
    'were recorded from the URL the query builder makes for %s',
    (_file, feed) => {
      const window = { from: new Date(feed.window.from), to: new Date(feed.window.to) };

      expect(buildSearchUrl(buildSearchQuery(feed.profile, window), parseNewsEdition(feed.edition)).href).toBe(feed.url);
    },
  );
});
