import { Test } from '@nestjs/testing';

import type { FoundArticle } from '../../src/domain/article';
import type { CompanyProfile } from '../../src/domain/company';
import type { DateRange } from '../../src/domain/date-range';
import { parseNewsEdition } from '../../src/domain/news-edition';
import type { NewsSource } from '../../src/news/news-source';
import { NEWS_SOURCE } from '../../src/news/news-source';
import { NewsModule } from '../../src/news/news.module';

/**
 * `npm run test:live` — real Google News, outside CI (ADR-006). Detects feed
 * format drift: if this fails while the recorded-fixture tests pass, re-record
 * with `npm run fixtures:google-news` and compare.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function lastDays(days: number): DateRange {
  const to = new Date();
  return { from: new Date(to.getTime() - days * DAY_MS), to };
}

function profile(displayName: string, overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return { displayName, aliases: [], domain: null, description: null, searchTerms: [], ...overrides };
}

function expectWellFormed(article: FoundArticle, window: DateRange, edition: string): void {
  expect(article.googleArticleId).toMatch(/^[A-Za-z0-9_-]{16,}$/);
  expect(article.googleUrl.startsWith('https://news.google.com/rss/articles/')).toBe(true);
  expect(article.title.trim()).not.toBe('');
  expect(article.snippet).not.toMatch(/[<>]/);
  expect(article.outletName.trim()).not.toBe('');
  expect(article.outletUrl).toMatch(/^https?:\/\//);
  if (article.publisherUrl !== null) {
    expect(article.publisherUrl).toMatch(/^https?:\/\//);
  }
  expect(article.publishedAt.getTime()).toBeGreaterThanOrEqual(window.from.getTime());
  expect(article.publishedAt.getTime()).toBeLessThan(window.to.getTime());
  expect(article.edition).toBe(edition);
}

describe('Google News RSS (live)', () => {
  let newsSource: NewsSource;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [NewsModule] }).compile();
    newsSource = moduleRef.get<NewsSource>(NEWS_SOURCE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('finds recent English coverage of a heavily covered company and resolves publisher URLs', async () => {
    const window = lastDays(2);

    const { articles } = await newsSource.findCandidates(profile('Stripe'), window, parseNewsEdition('en-US'));

    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expectWellFormed(article, window, 'en-US');
    }
    const resolved = articles.filter((article) => article.publisherUrl !== null).length;
    console.info(`Stripe, last 2 days: ${resolved}/${articles.length} publisher URLs resolved`);
    expect(resolved).toBeGreaterThan(0);
  });

  it('searches curated Search Terms', async () => {
    const window = lastDays(30);
    const harvey = profile('Harvey', { searchTerms: ['"Harvey" AI legal', '"Harvey AI"'] });

    const { articles } = await newsSource.findCandidates(harvey, window, parseNewsEdition('en-US'));

    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expectWellFormed(article, window, 'en-US');
    }
  });

  it('searches the Hebrew edition with a Hebrew alias', async () => {
    const window = lastDays(30);
    const island = profile('Island', { aliases: ['איילנד'] });

    const { articles } = await newsSource.findCandidates(island, window, parseNewsEdition('he-IL'));

    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expectWellFormed(article, window, 'he-IL');
      expect(article.language).toBe('he');
    }
  });
});
