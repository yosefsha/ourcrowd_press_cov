import { loadRecordedResponses, responseKey } from '../../test/pipeline/support/recorded-news';
import { selectArticles } from './article-selection';

const recordings = loadRecordedResponses();
const cerebras = recordings.get(responseKey('Cerebras', 'en-US')) ?? [];
const groq = recordings.get(responseKey('Groq', 'en-US')) ?? [];
const JULY = { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-08-01T00:00:00Z') };

describe('selectArticles', () => {
  it('keeps each recorded Article once, newest first', () => {
    const selection = selectArticles([...cerebras, ...cerebras], JULY, null);

    expect(selection.articles).toHaveLength(cerebras.length);
    expect(selection.truncated).toBe(false);
    const times = selection.articles.map((article) => article.publishedAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('keeps the first listing of an Article another search also returned', () => {
    const relabelled = groq.map((article) => ({ ...article, edition: 'he-IL' }));
    const selection = selectArticles([...cerebras, ...relabelled], JULY, null);
    const inBoth = (id: string): boolean =>
      cerebras.some((c) => c.googleArticleId === id) && groq.some((g) => g.googleArticleId === id);
    const shared = selection.articles.filter((article) => inBoth(article.googleArticleId));

    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((article) => article.edition === 'en-US')).toBe(true);
  });

  it('drops Articles published outside the window', () => {
    const window = { from: new Date('2026-07-23T00:00:00Z'), to: new Date('2026-07-24T00:00:00Z') };
    const selection = selectArticles(cerebras, window, null);

    expect(selection.articles.length).toBeGreaterThan(0);
    expect(selection.articles.every((article) => article.publishedAt.toISOString().startsWith('2026-07-23'))).toBe(true);
  });

  it('caps at the newest max Articles and says it truncated', () => {
    const selection = selectArticles(cerebras, JULY, 2);

    expect(selection.truncated).toBe(true);
    expect(selection.articles.map((article) => article.title)).toEqual([
      'CrowdStrike And Cerebras Partner To Power Falcon AIDR',
      'AMD AAI 2026 Keynote Cerebras',
    ]);
  });

  it('is not truncated at exactly the cap', () => {
    expect(selectArticles(cerebras, JULY, cerebras.length).truncated).toBe(false);
  });
});
