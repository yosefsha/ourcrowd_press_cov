import { collapseWhitespace, decodeHtmlEntities, htmlToText } from './html-text';

describe('htmlToText', () => {
  it('reduces a Google News description to its text', () => {
    expect(
      htmlToText(
        '<a href="https://news.google.com/rss/articles/x" target="_blank">Stripe &amp; Co raise</a>&nbsp;&nbsp;<font color="#6f6f6f">Reuters</font>',
      ),
    ).toBe('Stripe & Co raise Reuters');
  });

  it('drops script and style blocks with their content', () => {
    expect(htmlToText('a<script>alert(1)</script>b<style>p{}</style>c')).toBe('a b c');
  });

  it('never leaves markup behind', () => {
    expect(htmlToText('<img src=x onerror=alert(1)>hello<br/>world')).toBe('hello world');
  });

  it('returns an empty string for an empty fragment', () => {
    expect(htmlToText('')).toBe('');
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes named, decimal and hex references', () => {
    expect(decodeHtmlEntities('&quot;a&quot; &#39;b&#39; &#x2014; &rsquo;')).toBe('"a" \'b\' — ’');
  });

  it('leaves unknown and out-of-range references as written', () => {
    expect(decodeHtmlEntities('&bogus; &#0; &#x110000;')).toBe('&bogus; &#0; &#x110000;');
  });
});

describe('collapseWhitespace', () => {
  it('collapses runs of whitespace including non-breaking spaces', () => {
    expect(collapseWhitespace('  a \n\t b  c  ')).toBe('a b c');
  });
});
