import {
  recordedFeed,
  recordedNewsSource,
  recordedPublisherUrl,
  RecordedGoogleNewsTransport,
} from '../../../test/fixtures/google-news/recorded-google-news';
import type { GoogleNewsRequest, GoogleNewsTransport } from '../google-news/google-news-transport';
import { GoogleNewsRequestFailed } from '../google-news/google-news-transport';
import { NewsSourceUnavailable } from '../news-source';
import type { PublisherUrlResolver } from '../publisher-url-resolver';
import { GoogleNewsRssNewsSource } from './google-news-rss.news-source';

/** Answers every search with one fixed body, as if the feed ignored the query. */
class FixedFeedTransport implements GoogleNewsTransport {
  readonly requests: GoogleNewsRequest[] = [];
  constructor(private readonly body: string | Error) {}

  fetchText(request: GoogleNewsRequest): Promise<string> {
    this.requests.push(request);
    return this.body instanceof Error ? Promise.reject(this.body) : Promise.resolve(this.body);
  }
}

class CountingResolver implements PublisherUrlResolver {
  calls = 0;
  constructor(private readonly answer: (googleArticleId: string) => string | null) {}

  resolvePublisherUrl(googleArticleId: string): Promise<string | null> {
    this.calls += 1;
    return Promise.resolve(this.answer(googleArticleId));
  }
}

describe('GoogleNewsRssNewsSource over recorded feeds', () => {
  it('returns a capped search with every Article inside the window', async () => {
    const stripe = recordedFeed('stripe.en-US.xml');

    const result = await recordedNewsSource().findCandidates(stripe.profile, stripe.window, stripe.edition);

    expect(result.capped).toBe(true);
    expect(result.articles.length).toBeGreaterThan(90);
    for (const article of result.articles) {
      expect(article.publishedAt.getTime()).toBeGreaterThanOrEqual(stripe.window.from.getTime());
      expect(article.publishedAt.getTime()).toBeLessThan(stripe.window.to.getTime());
    }
  });

  it('resolves the publisher URL where it can and keeps null elsewhere', async () => {
    const stripe = recordedFeed('stripe.en-US.xml');
    const publisher = recordedPublisherUrl();

    const { articles } = await recordedNewsSource().findCandidates(stripe.profile, stripe.window, stripe.edition);

    const resolved = articles.find((article) => article.googleArticleId === publisher.googleArticleId);
    expect(resolved?.publisherUrl).toBe(publisher.resolvedUrl);
    expect(articles.filter((article) => article.publisherUrl === null).length).toBe(articles.length - 1);
  });

  it('searches the Hebrew edition with the display name OR its Hebrew alias', async () => {
    const island = recordedFeed('island.he-IL.xml');
    const transport = new RecordedGoogleNewsTransport();

    const result = await recordedNewsSource(transport).findCandidates(island.profile, island.window, island.edition);

    expect(transport.requests[0]?.url.searchParams.get('q')).toBe(
      '("Island" OR "איילנד") after:2026-06-30 before:2026-10-02',
    );
    expect(result.capped).toBe(false);
    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.articles.every((article) => article.edition === 'he-IL' && article.language === 'he')).toBe(true);
  });

  it('returns an uncapped empty result', async () => {
    const siteaware = recordedFeed('siteaware.en-US.xml');

    await expect(
      recordedNewsSource().findCandidates(siteaware.profile, siteaware.window, siteaware.edition),
    ).resolves.toEqual({ articles: [], capped: false });
  });

  it('drops Articles published outside the window but still reports the cap', async () => {
    const harvey = recordedFeed('harvey.en-US.xml');
    const september = { from: new Date('2026-09-15T00:00:00Z'), to: new Date('2026-09-22T00:00:00Z') };
    const source = new GoogleNewsRssNewsSource(
      new FixedFeedTransport(harvey.xml),
      new CountingResolver(() => null),
    );

    const result = await source.findCandidates(harvey.profile, september, harvey.edition);

    expect(result.capped).toBe(true);
    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.articles.length).toBeLessThan(100);
    for (const article of result.articles) {
      expect(article.publishedAt >= september.from && article.publishedAt < september.to).toBe(true);
    }
  });

  it('stops resolving publisher URLs after three failures in a row', async () => {
    const harvey = recordedFeed('harvey.en-US.xml');
    const resolver = new CountingResolver(() => null);
    const source = new GoogleNewsRssNewsSource(new FixedFeedTransport(harvey.xml), resolver);

    const { articles } = await source.findCandidates(harvey.profile, harvey.window, harvey.edition);

    expect(resolver.calls).toBe(3);
    expect(articles.every((article) => article.publisherUrl === null)).toBe(true);
  });

  it('keeps resolving while resolutions succeed', async () => {
    const zutaCore = recordedFeed('zutacore.he-IL.xml');
    const resolver = new CountingResolver(() => 'https://www.calcalist.co.il/article/1');
    const source = new GoogleNewsRssNewsSource(new FixedFeedTransport(zutaCore.xml), resolver);

    const { articles } = await source.findCandidates(zutaCore.profile, zutaCore.window, zutaCore.edition);

    expect(articles.map((article) => article.publisherUrl)).toEqual(['https://www.calcalist.co.il/article/1']);
  });
});

describe('GoogleNewsRssNewsSource errors', () => {
  const stripe = recordedFeed('stripe.en-US.xml');

  it('maps a transport failure to NewsSourceUnavailable, keeping the cause', async () => {
    const cause = new GoogleNewsRequestFailed('Google News answered HTTP 503', 503);
    const source = new GoogleNewsRssNewsSource(new FixedFeedTransport(cause), new CountingResolver(() => null));

    const failure = source.findCandidates(stripe.profile, stripe.window, stripe.edition);

    await expect(failure).rejects.toThrow(NewsSourceUnavailable);
    await expect(failure).rejects.toMatchObject({ cause });
  });

  it('maps any unexpected transport error to NewsSourceUnavailable', async () => {
    const source = new GoogleNewsRssNewsSource(
      new FixedFeedTransport(new TypeError('socket hang up')),
      new CountingResolver(() => null),
    );

    await expect(source.findCandidates(stripe.profile, stripe.window, stripe.edition)).rejects.toThrow(
      NewsSourceUnavailable,
    );
  });

  it.each([
    ['an HTML error page', '<!doctype html><html><body>Our systems have detected unusual traffic</body></html>'],
    ['a truncated feed', stripe.xml.slice(0, 5000)],
  ])('maps %s to NewsSourceUnavailable', async (_case, body) => {
    const source = new GoogleNewsRssNewsSource(new FixedFeedTransport(body), new CountingResolver(() => null));

    await expect(source.findCandidates(stripe.profile, stripe.window, stripe.edition)).rejects.toThrow(
      NewsSourceUnavailable,
    );
  });

  it('answers a search nothing was recorded for as unavailable', async () => {
    await expect(
      recordedNewsSource().findCandidates({ ...stripe.profile, displayName: 'Unrecorded' }, stripe.window, stripe.edition),
    ).rejects.toThrow(NewsSourceUnavailable);
  });

  it('rejects an inverted window before sending anything', async () => {
    const transport = new FixedFeedTransport(stripe.xml);
    const source = new GoogleNewsRssNewsSource(transport, new CountingResolver(() => null));

    await expect(
      source.findCandidates(stripe.profile, { from: stripe.window.to, to: stripe.window.from }, stripe.edition),
    ).rejects.toThrow(RangeError);
    expect(transport.requests).toHaveLength(0);
  });
});
