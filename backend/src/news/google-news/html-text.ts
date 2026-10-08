const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  shy: '',
};

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;
const MAX_CODE_POINT = 0x10ffff;

/** Decodes HTML character references; unknown or invalid references are left as written. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(ENTITY_PATTERN, (reference: string, body: string): string => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const codePoint = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > MAX_CODE_POINT) {
        return reference;
      }
      return String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? reference;
  });
}

/** Collapses every run of whitespace (including non-breaking spaces) to one space and trims. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Reduces an HTML fragment (a Google News item description) to plain text:
 * script/style blocks and tags removed, entities decoded, whitespace collapsed.
 * The result is text only — never markup — so it is safe to render escaped.
 */
export function htmlToText(html: string): string {
  const withoutBlocks = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, ' ');
  return collapseWhitespace(decodeHtmlEntities(withoutTags));
}
