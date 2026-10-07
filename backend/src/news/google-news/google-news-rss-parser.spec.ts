import { recordedFeed } from '../../../test/fixtures/google-news/recorded-google-news';
import { parseNewsEdition } from '../../domain/news-edition';
import { GoogleNewsFeedUnreadable, parseGoogleNewsRss } from './google-news-rss-parser';

const EN_US = parseNewsEdition('en-US');
const HE_IL = parseNewsEdition('he-IL');

/** The single real item of the recorded ZutaCore he-IL feed, as XML. */
function zutaCoreItem(): string {
  const match = /<item>[\s\S]*?<\/item>/.exec(recordedFeed('zutacore.he-IL.xml').xml);
  if (match === null) {
    throw new Error('The ZutaCore fixture has no item');
  }
  return match[0];
}

/** The recorded ZutaCore feed with its items replaced. */
function zutaCoreFeedWith(items: readonly string[]): string {
  return recordedFeed('zutacore.he-IL.xml').xml.replace(/<item>[\s\S]*<\/item>/, items.join(''));
}

describe('parseGoogleNewsRss over recorded feeds', () => {
  it('reads every item of a full (capped) feed', () => {
    const feed = parseGoogleNewsRss(recordedFeed('stripe.en-US.xml').xml, EN_US);

    expect(feed.itemCount).toBe(100);
    expect(feed.articles.length).toBeGreaterThan(95);
    for (const article of feed.articles) {
      expect(article.googleArticleId).toMatch(/^CBM[A-Za-z0-9_-]+$/);
      expect(article.googleUrl).toBe(
        `https://news.google.com/rss/articles/${article.googleArticleId}?oc=5`,
      );
      expect(article.title).not.toBe('');
      expect(article.snippet).not.toMatch(/[<>]/);
      expect(article.outletUrl).toMatch(/^https?:\/\//);
      expect(article.publisherUrl).toBeNull();
      expect(Number.isNaN(article.publishedAt.getTime())).toBe(false);
      expect(article.language).toBe('en');
      expect(article.edition).toBe('en-US');
    }
  });

  it('extracts the article ID the feed also gives as the item guid', () => {
    const xml = recordedFeed('harvey.en-US.xml').xml;
    const guids = [...xml.matchAll(/<guid isPermaLink="false">([^<]+)<\/guid>/g)].map((m) => m[1]);
    const ids = parseGoogleNewsRss(xml, EN_US).articles.map((article) => article.googleArticleId);

    expect(ids).toEqual(guids.filter((guid, index) => guids.indexOf(guid) === index));
  });

  it('keeps unrelated stories for an ambiguous name — relevance is decided later', () => {
    const titles = parseGoogleNewsRss(recordedFeed('harvey.en-US.xml').xml, EN_US).articles.map(
      (article) => article.title,
    );

    expect(titles).toContain('Harvey Weinstein sentenced to 15 years on New York sex crime conviction');
    expect(titles).toContain('Harvey to Open Boston Office');
  });

  it('parses a Hebrew edition item: title, snippet, Outlet and date', () => {
    const feed = parseGoogleNewsRss(recordedFeed('zutacore.he-IL.xml').xml, HE_IL);

    expect(feed.itemCount).toBe(1);
    expect(feed.articles).toEqual([
      {
        googleArticleId:
          'CBMia0FVX3lxTE5rRzU1ODNfT2lkRGQ5M1lnT08zYlRTRGtkcjI3eGJTVGtZcUh6bEFSaXZ6TWZHVEQ4RVRxdHNiZmdNYnVXNFZVYjhFWmFXbjBvNVJhcUNJejJuYmtoNlk0SDVselhqdzZGblRr',
        title: 'על שם אופיר ליבשטיין: קרן חדשה יוצאת לדרך עם כ־30 מיליון דולר להשקעות בנגב',
        snippet: 'על שם אופיר ליבשטיין: קרן חדשה יוצאת לדרך עם כ־30 מיליון דולר להשקעות בנגב',
        outletName: 'calcalist',
        outletUrl: 'https://www.calcalist.co.il/',
        googleUrl:
          'https://news.google.com/rss/articles/CBMia0FVX3lxTE5rRzU1ODNfT2lkRGQ5M1lnT08zYlRTRGtkcjI3eGJTVGtZcUh6bEFSaXZ6TWZHVEQ4RVRxdHNiZmdNYnVXNFZVYjhFWmFXbjBvNVJhcUNJejJuYmtoNlk0SDVselhqdzZGblRr?oc=5',
        publisherUrl: null,
        publishedAt: new Date('2026-08-13T07:00:00Z'),
        language: 'he',
        edition: 'he-IL',
      },
    ]);
  });

  it('removes the " - Outlet" suffix Google appends to titles once', () => {
    const titles = parseGoogleNewsRss(recordedFeed('stripe.en-US.xml').xml, EN_US).articles.map(
      (article) => article.title,
    );

    expect(titles).toContain('Stripe swallows Parafin');
    // Recorded as "… - University of Minnesota Athletics - University of Minnesota Athletics".
    expect(titles).toContain(
      "Coach Fleck Previews Saturday's Stripe Out Against Michigan - University of Minnesota Athletics",
    );
  });

  it('decodes entities in titles', () => {
    const titles = parseGoogleNewsRss(recordedFeed('harvey.en-US.xml').xml, EN_US).articles.map(
      (article) => article.title,
    );

    expect(titles).toContain('5th District Q&A: Cooke Harvey, John McGuire, Tom Perriello');
  });

  it('reads an empty result', () => {
    expect(parseGoogleNewsRss(recordedFeed('siteaware.en-US.xml').xml, EN_US)).toEqual({
      articles: [],
      itemCount: 0,
    });
  });
});

describe('parseGoogleNewsRss on altered recordings', () => {
  it('keeps a repeated article once but counts every item', () => {
    const item = zutaCoreItem();
    const feed = parseGoogleNewsRss(zutaCoreFeedWith([item, item]), HE_IL);

    expect(feed.itemCount).toBe(2);
    expect(feed.articles).toHaveLength(1);
  });

  it.each([
    ['a javascript: Outlet URL', (item: string) => item.replace('url="https://www.calcalist.co.il"', 'url="javascript:alert(1)"')],
    ['a data: Outlet URL', (item: string) => item.replace('url="https://www.calcalist.co.il"', 'url="data:text/html,x"')],
    ['a link off news.google.com', (item: string) => item.replace(/<link>https:\/\/news\.google\.com/, '<link>https://evil.example')],
    ['a javascript: link', (item: string) => item.replace(/<link>[^<]+<\/link>/, '<link>javascript:alert(1)</link>')],
    ['no Outlet', (item: string) => item.replace(/<source[^>]*>[^<]*<\/source>/, '')],
    ['an invalid date', (item: string) => item.replace(/<pubDate>[^<]+<\/pubDate>/, '<pubDate>someday</pubDate>')],
  ])('skips an item with %s', (_case, alter) => {
    const good = zutaCoreItem();
    const bad = alter(good.replace(/CBMia0FVX3lx/g, 'CBMiBADITEMx'));
    const feed = parseGoogleNewsRss(zutaCoreFeedWith([bad, good]), HE_IL);

    expect(feed.itemCount).toBe(2);
    expect(feed.articles.map((article) => article.googleArticleId)).toEqual([
      expect.stringMatching(/^CBMia0FVX3lx/),
    ]);
  });

  it('reduces titles and Outlet names to plain text, never markup', () => {
    const item = zutaCoreItem()
      .replace(/<title>[^<]*<\/title>/, '<title>&lt;img src=x onerror=alert(1)&gt;Funding round - calcalist</title>')
      .replace('>calcalist</source>', '>&lt;b&gt;calcalist&lt;/b&gt;</source>');
    const [article] = parseGoogleNewsRss(zutaCoreFeedWith([item]), HE_IL).articles;

    expect(article?.title).toBe('Funding round');
    expect(article?.outletName).toBe('calcalist');
  });

  it('fails when items exist but none can be read (a format change)', () => {
    const unreadable = zutaCoreItem().replace(/<source[^>]*>[^<]*<\/source>/, '');

    expect(() => parseGoogleNewsRss(zutaCoreFeedWith([unreadable]), HE_IL)).toThrow(
      GoogleNewsFeedUnreadable,
    );
  });

  it.each([
    ['malformed XML', '<rss><channel><item></channel>'],
    ['an HTML page', '<!doctype html><html><body>Sorry</body></html>'],
    ['XML that is not RSS', '<?xml version="1.0"?><feed></feed>'],
    ['an empty body', ''],
    [
      'a DOCTYPE with entities (billion laughs)',
      '<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;">]><rss><channel><title>&b;</title></channel></rss>',
    ],
  ])('fails on %s', (_case, body) => {
    expect(() => parseGoogleNewsRss(body, EN_US)).toThrow(GoogleNewsFeedUnreadable);
  });
});
