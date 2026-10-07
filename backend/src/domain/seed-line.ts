/**
 * What one Seed List line says about a company: the pre-filled, editable part
 * of its Company Profile (ADR-010) plus the line itself as its Source Name.
 */
export interface SeedCompany {
  /** The exact Seed List line (trimmed); never changes. */
  readonly sourceName: string;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly domain: string | null;
}

export class UnparseableSeedLine extends Error {
  constructor(
    readonly line: string,
    readonly reason: string,
    readonly lineNumber: number | null = null,
  ) {
    super(`Cannot parse Seed List line${lineNumber === null ? '' : ` ${lineNumber}`} "${line}": ${reason}`);
    this.name = 'UnparseableSeedLine';
  }
}

const BYTE_ORDER_MARK = '﻿';
const TRAILING_PARENTHETICAL = /^(.*?)\s*\(([^()]*)\)$/;
const FORMERLY = /^formerly(?:\s+known\s+as)?\s+(.+)$/i;
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
const LEGAL_SUFFIX = /,?\s+(?:Ltd|Inc|LLC|Corp|GmbH|plc|S\.A|B\.V)\.?$/i;

/**
 * Parses one Seed List line:
 * - `X (formerly Y)` / `X (formerly known as Y)` → display name X, alias Y;
 * - `X (domain.tld)` → display name X, domain `domain.tld`;
 * - `X (Expansion)`, e.g. `SSI (Safe Superintelligence)` → alias `Expansion`;
 * - a legal suffix (`Ltd.`, `Inc.` …) is stripped from the display name and the
 *   full form kept as an alias.
 *
 * Throws `UnparseableSeedLine` for a blank line, an empty name, an empty or
 * nested parenthetical, or parentheses anywhere but at the end.
 */
export function parseSeedLine(rawLine: string, lineNumber: number | null = null): SeedCompany {
  const line = rawLine.replace(BYTE_ORDER_MARK, '').trim();
  const fail = (reason: string): never => {
    throw new UnparseableSeedLine(rawLine, reason, lineNumber);
  };
  if (line === '') fail('the line is blank');

  let name = line;
  let parenthetical: string | null = null;
  const match = TRAILING_PARENTHETICAL.exec(line);
  if (match !== null) {
    name = (match[1] ?? '').trim();
    parenthetical = (match[2] ?? '').trim();
  }
  if (/[()]/.test(name)) fail('parentheses are only allowed once, at the end of the line');
  if (parenthetical === '') fail('the parenthetical is empty');

  const aliases: string[] = [];
  let domain: string | null = null;
  if (parenthetical !== null) {
    const formerly = FORMERLY.exec(parenthetical);
    if (formerly !== null) aliases.push((formerly[1] ?? '').trim());
    else if (DOMAIN.test(parenthetical)) domain = parenthetical.toLowerCase();
    else aliases.push(parenthetical);
  }

  let displayName = name;
  const withoutSuffix = name.replace(LEGAL_SUFFIX, '').trim();
  if (withoutSuffix !== name && withoutSuffix !== '') {
    displayName = withoutSuffix;
    aliases.unshift(name);
  }
  if (displayName === '') fail('the company name is empty');

  const seen = new Set([displayName.toLowerCase()]);
  const distinctAliases = aliases.filter((alias) => {
    const key = alias.toLowerCase();
    if (alias === '' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { sourceName: line, displayName, aliases: distinctAliases, domain };
}

/**
 * Parses the whole Seed List file: strips a UTF-8 byte-order mark, accepts LF or
 * CRLF line endings and skips blank lines. A Source Name appearing twice is
 * rejected, since each must identify exactly one Tracked Company.
 */
export function parseSeedList(text: string): readonly SeedCompany[] {
  const companies: SeedCompany[] = [];
  const sourceNames = new Set<string>();
  text
    .replace(BYTE_ORDER_MARK, '')
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (line.trim() === '') return;
      const company = parseSeedLine(line, index + 1);
      if (sourceNames.has(company.sourceName)) {
        throw new UnparseableSeedLine(line, 'the same line appears earlier in the Seed List', index + 1);
      }
      sourceNames.add(company.sourceName);
      companies.push(company);
    });
  return companies;
}
