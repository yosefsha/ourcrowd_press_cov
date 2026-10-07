import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseSeedLine, parseSeedList, type SeedCompany, UnparseableSeedLine } from './seed-line';

const SEED_LIST_PATH = join(__dirname, '..', '..', '..', 'docs', 'ourcrowd_companies.txt');

/** Every line of the real Seed List that the parser does more with than copy. */
const SPECIAL_LINES: Readonly<Record<string, Omit<SeedCompany, 'sourceName'>>> = {
  'Lambda (lambda.ai)': { displayName: 'Lambda', aliases: [], domain: 'lambda.ai' },
  'SSI (Safe Superintelligence)': { displayName: 'SSI', aliases: ['Safe Superintelligence'], domain: null },
  'Ludeo (formerly Edge)': { displayName: 'Ludeo', aliases: ['Edge'], domain: null },
  'Oshi (formerly Plantish)': { displayName: 'Oshi', aliases: ['Plantish'], domain: null },
  'One Zero Digital Bank Ltd.': {
    displayName: 'One Zero Digital Bank',
    aliases: ['One Zero Digital Bank Ltd.'],
    domain: null,
  },
  'Cycuity (formerly Tortuga Logic)': { displayName: 'Cycuity', aliases: ['Tortuga Logic'], domain: null },
  'HEQA Security (formerly QuantLR)': { displayName: 'HEQA Security', aliases: ['QuantLR'], domain: null },
  'BlueCircle (formerly Trellis)': { displayName: 'BlueCircle', aliases: ['Trellis'], domain: null },
  'Momentis Surgical (formerly Memic)': { displayName: 'Momentis Surgical', aliases: ['Memic'], domain: null },
  'Firefly Neuroscience (formerly ElMindA)': {
    displayName: 'Firefly Neuroscience',
    aliases: ['ElMindA'],
    domain: null,
  },
  'Lifeward (formerly known as ReWalk)': { displayName: 'Lifeward', aliases: ['ReWalk'], domain: null },
  'Xsense (formerly BT9)': { displayName: 'Xsense', aliases: ['BT9'], domain: null },
  'Incredo (formerly known as DouxMatok)': { displayName: 'Incredo', aliases: ['DouxMatok'], domain: null },
};

describe('parseSeedList against the real Seed List (docs/ourcrowd_companies.txt)', () => {
  const text = readFileSync(SEED_LIST_PATH, 'utf8');
  const rawLines = text
    .replace('﻿', '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const companies = parseSeedList(text);

  it('really starts with a byte-order mark, which never reaches a Source Name', () => {
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(companies[0]?.sourceName).toBe('ZutaCore');
    expect(companies.every((company) => !company.sourceName.includes('﻿'))).toBe(true);
  });

  it('yields one company per non-blank line, in file order, with the line as Source Name', () => {
    expect(rawLines.length).toBeGreaterThan(250);
    expect(companies.map((company) => company.sourceName)).toEqual(rawLines);
  });

  it('covers every special line it expects to find', () => {
    expect(rawLines).toEqual(expect.arrayContaining(Object.keys(SPECIAL_LINES)));
  });

  it.each(rawLines.map((line) => [line]))('parses %j', (line) => {
    const expected = SPECIAL_LINES[line] ?? { displayName: line, aliases: [], domain: null };

    expect(parseSeedLine(line)).toEqual({ sourceName: line, ...expected });
  });

  it('yields distinct display names, as the unique index on them requires', () => {
    const names = companies.map((company) => company.displayName.toLowerCase());

    expect(new Set(names).size).toBe(names.length);
  });
});

describe('parseSeedLine', () => {
  it('keeps dotted names that are the company name, not a domain', () => {
    expect(parseSeedLine('Binah.ai')).toEqual({
      sourceName: 'Binah.ai',
      displayName: 'Binah.ai',
      aliases: [],
      domain: null,
    });
  });

  it('strips Inc. and lower-cases a domain', () => {
    expect(parseSeedLine('  Acme, Inc. (Acme.IO)  ')).toEqual({
      sourceName: 'Acme, Inc. (Acme.IO)',
      displayName: 'Acme',
      aliases: ['Acme, Inc.'],
      domain: 'acme.io',
    });
  });

  it('does not repeat an alias equal to the display name', () => {
    expect(parseSeedLine('Acme (formerly ACME)').aliases).toEqual([]);
  });

  it('does not strip a suffix that is the whole name', () => {
    expect(parseSeedLine('Inc').displayName).toBe('Inc');
  });

  it.each([
    ['', 'blank'],
    ['   ', 'blank'],
    ['Acme ()', 'empty parenthetical'],
    ['(formerly Acme)', 'no name before the parenthetical'],
    ['Acme (Inc) Labs', 'parenthetical not at the end'],
    ['Acme (a (b))', 'nested parentheses'],
    ['Acme (unclosed', 'unbalanced parenthesis'],
    ['Acme) Labs', 'stray closing parenthesis'],
  ])('rejects %j (%s)', (line) => {
    expect(() => parseSeedLine(line, 7)).toThrow(UnparseableSeedLine);
  });

  it('names the line number in the error', () => {
    expect(() => parseSeedLine('Acme ()', 12)).toThrow(/line 12/);
  });
});

describe('parseSeedList', () => {
  it('skips blank lines and accepts LF endings', () => {
    expect(parseSeedList('Alpha\n\n  \nBeta\n').map((company) => company.displayName)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('returns nothing for an empty file', () => {
    expect(parseSeedList('﻿')).toEqual([]);
  });

  it('rejects a repeated line, naming where it repeats', () => {
    expect(() => parseSeedList('Alpha\r\nBeta\r\nAlpha')).toThrow(/line 3/);
  });

  it('reports an unparseable line with its line number', () => {
    expect(() => parseSeedList('Alpha\r\nBeta ()')).toThrow(UnparseableSeedLine);
    expect(() => parseSeedList('Alpha\r\nBeta ()')).toThrow(/line 2/);
  });
});
