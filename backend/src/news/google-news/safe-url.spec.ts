import { toHttpUrl } from './safe-url';

describe('toHttpUrl', () => {
  it.each([
    ['https://www.calcalist.co.il', 'https://www.calcalist.co.il/'],
    ['http://example.com/a?b=1', 'http://example.com/a?b=1'],
    ['  https://example.com/x  ', 'https://example.com/x'],
  ])('keeps the web URL %s', (input, expected) => {
    expect(toHttpUrl(input)).toBe(expected);
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
    ['file:', 'file:///etc/passwd'],
    ['ftp:', 'ftp://example.com/'],
    ['a relative path', '/news/1'],
    ['credentials', 'https://user:pass@example.com/'],
    ['blank', '   '],
    ['garbage', 'not a url'],
  ])('drops %s', (_case, input) => {
    expect(toHttpUrl(input)).toBeNull();
  });

  it('drops non-strings', () => {
    expect(toHttpUrl(undefined)).toBeNull();
    expect(toHttpUrl(42)).toBeNull();
  });
});
