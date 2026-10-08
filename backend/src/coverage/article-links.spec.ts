import { articleLink, safeHttpUrl } from './article-links';

describe('safeHttpUrl', () => {
  it.each(['https://www.reuters.com/a', 'http://example.org/'])('keeps the web URL %s', (url) => {
    expect(safeHttpUrl(url)).toBe(url);
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://example.org/', '/relative', '', 'not a url'])(
    'drops %p',
    (url) => {
      expect(safeHttpUrl(url)).toBeNull();
    },
  );

  it('passes null through', () => {
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe('articleLink', () => {
  const googleUrl = 'https://news.google.com/rss/articles/CBMi?oc=5';

  it('prefers the publisher URL', () => {
    expect(articleLink({ publisherUrl: 'https://www.calcalistech.com/ctechnews/article/x', googleUrl })).toBe(
      'https://www.calcalistech.com/ctechnews/article/x',
    );
  });

  it('falls back to the Google News URL when the publisher URL is missing or unsafe', () => {
    expect(articleLink({ publisherUrl: null, googleUrl })).toBe(googleUrl);
    expect(articleLink({ publisherUrl: 'javascript:alert(1)', googleUrl })).toBe(googleUrl);
  });

  it('is null when neither is a web URL', () => {
    expect(articleLink({ publisherUrl: null, googleUrl: 'javascript:alert(1)' })).toBeNull();
  });
});
