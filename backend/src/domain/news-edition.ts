/**
 * A language-and-region variant of a News Source searched separately, written
 * `<language>-<COUNTRY>` (e.g. `en-US`, `he-IL`).
 */
export interface NewsEdition {
  /** The edition as configured, e.g. `he-IL`. */
  readonly code: string;
  /** ISO 639-1 language, lower case, e.g. `he`. */
  readonly language: string;
  /** ISO 3166-1 alpha-2 country, upper case, e.g. `IL`. */
  readonly country: string;
}

export class InvalidNewsEdition extends Error {
  constructor(readonly value: string, reason: string) {
    super(`Invalid News Edition "${value}": ${reason}`);
    this.name = 'InvalidNewsEdition';
  }
}

const EDITION_PATTERN = /^([a-z]{2})-([A-Z]{2})$/;

/** Parses one edition code such as `en-US`. */
export function parseNewsEdition(value: string): NewsEdition {
  const match = EDITION_PATTERN.exec(value.trim());
  if (match === null) {
    throw new InvalidNewsEdition(value, 'expected <language>-<COUNTRY>, e.g. en-US');
  }
  const [code, language, country] = match as unknown as [string, string, string];
  return { code, language, country };
}

/** Parses a comma-separated, non-empty list of distinct editions (`en-US,he-IL`). */
export function parseNewsEditions(value: string): readonly [NewsEdition, ...NewsEdition[]] {
  const editions = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map(parseNewsEdition);
  const [first, ...rest] = editions;
  if (first === undefined) {
    throw new InvalidNewsEdition(value, 'at least one edition is required');
  }
  const codes = new Set(editions.map((edition) => edition.code));
  if (codes.size !== editions.length) {
    throw new InvalidNewsEdition(value, 'editions must be distinct');
  }
  return [first, ...rest];
}
