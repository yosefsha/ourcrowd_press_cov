import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  InvalidLabellingSheet,
  parseLabellingSheetCsv,
  parseLabellingSheetMarkdown,
  renderLabellingSheetCsv,
  renderLabellingSheetMarkdown,
} from './labelling-sheet';
import { parseValidationSet, type ValidationSet } from './validation-set';

const REPO = join(__dirname, '..', '..', '..', '..');
const SET_PATH = join(REPO, 'backend', 'test', 'fixtures', 'validation', 'validation-set.json');
const SET = parseValidationSet(JSON.parse(readFileSync(SET_PATH, 'utf8')), SET_PATH);

/** The committed set cut to its first `count` items. */
function firstItems(count: number): ValidationSet {
  return { ...SET, items: SET.items.slice(0, count) };
}

/** Fills the two label cells of the Markdown row for `id`. */
function fillMarkdown(sheet: string, id: string, relevant: string, sentiment: string): string {
  return sheet
    .split('\n')
    .map((line) => (line.startsWith(`| ${id} |`) ? line.replace(/\| {2}\| {2}\|$/, `| ${relevant} | ${sentiment} |`) : line))
    .join('\n');
}

/** Fills the two label fields of the CSV record for `id` (its last two, empty, fields). */
function fillCsv(sheet: string, id: string, relevant: string, sentiment: string): string {
  return sheet
    .split('\r\n')
    .map((line) => (line.startsWith(`${id},`) ? `${line.slice(0, -2)},${relevant},${sentiment}` : line))
    .join('\r\n');
}

describe('the labelling sheet', () => {
  it('renders one blank row per item, which reads back as all unlabelled', () => {
    const sheet = renderLabellingSheetMarkdown(SET);

    expect(parseLabellingSheetMarkdown(sheet, 'sheet.md')).toEqual({
      labels: [],
      unlabelled: SET.items.map((item) => item.id),
    });
    expect(parseLabellingSheetCsv(renderLabellingSheetCsv(SET), 'sheet.csv').unlabelled).toHaveLength(SET.items.length);
  });

  it('shows the company, article and link but no model verdict', () => {
    const [item] = SET.items;
    const sheet = renderLabellingSheetMarkdown(firstItems(1));

    expect(sheet).toContain(`| ${item?.id} | ${item?.company.displayName} |`);
    expect(sheet).toContain(`[open](${item?.article.url})`);
    expect(sheet).not.toMatch(/reason|verdict:/i);
  });

  it('reads filled Markdown labels, tolerating case and long forms', () => {
    const [a, b, c] = SET.items.map((item) => item.id) as [string, string, string];
    let sheet = renderLabellingSheetMarkdown(firstItems(4));
    sheet = fillMarkdown(sheet, a, 'y', 'pos');
    sheet = fillMarkdown(sheet, b, 'No', '');
    sheet = fillMarkdown(sheet, c, 'YES', 'Negative');

    expect(parseLabellingSheetMarkdown(sheet, 'sheet.md')).toEqual({
      labels: [
        { id: a, relevant: true, sentiment: 'positive' },
        { id: b, relevant: false, sentiment: null },
        { id: c, relevant: true, sentiment: 'negative' },
      ],
      unlabelled: [SET.items[3]?.id],
    });
  });

  it('keeps a relevant item whose sentiment is not labelled yet', () => {
    const id = SET.items[0]?.id;
    const sheet = fillMarkdown(renderLabellingSheetMarkdown(firstItems(1)), id, 'y', '');

    expect(parseLabellingSheetMarkdown(sheet, 'sheet.md').labels).toEqual([{ id, relevant: true, sentiment: null }]);
  });

  it('escapes pipes and markup in feed text so the table and the labels survive', () => {
    const [item] = SET.items;
    if (item === undefined) throw new Error('empty set');
    const tricky: ValidationSet = {
      ...SET,
      items: [{ ...item, article: { ...item.article, title: 'A | B <script>x</script> \\ C' } }],
    };
    const sheet = fillMarkdown(renderLabellingSheetMarkdown(tricky), item.id, 'n', '');

    expect(sheet).toContain('A \\| B &lt;script&gt;x&lt;/script&gt; \\\\ C');
    expect(parseLabellingSheetMarkdown(sheet, 'sheet.md').labels).toEqual([{ id: item.id, relevant: false, sentiment: null }]);
  });

  it('reads filled CSV labels, quoted fields with commas, quotes and line breaks included', () => {
    const [item] = SET.items;
    if (item === undefined) throw new Error('empty set');
    const tricky: ValidationSet = {
      ...SET,
      items: [{ ...item, article: { ...item.article, title: 'Raises, "big"\nround' } }],
    };
    const csv = renderLabellingSheetCsv(tricky);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Raises, ""big""\nround"');

    expect(parseLabellingSheetCsv(fillCsv(csv, item.id, 'y', 'neu'), 'sheet.csv').labels).toEqual([
      { id: item.id, relevant: true, sentiment: 'neutral' },
    ]);
  });

  it('neutralizes feed text a spreadsheet would run as a formula', () => {
    const [item] = SET.items;
    if (item === undefined) throw new Error('empty set');
    const tricky: ValidationSet = { ...SET, items: [{ ...item, article: { ...item.article, title: '=HYPERLINK("x")', outlet: '@evil' } }] };

    const csv = renderLabellingSheetCsv(tricky);

    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('"\'@evil"');
    expect(csv).not.toMatch(/,=|,@/);
  });

  it('percent-encodes parentheses in the link target', () => {
    const [item] = SET.items;
    if (item === undefined) throw new Error('empty set');
    const tricky: ValidationSet = { ...SET, items: [{ ...item, article: { ...item.article, url: 'https://news.google.com/a)b(c' } }] };

    expect(renderLabellingSheetMarkdown(tricky)).toContain('[open](https://news.google.com/a%29b%28c)');
  });

  it.each([
    ['an unknown relevance value', 'maybe', '', 'relevant must be y or n, found "maybe"'],
    ['an unknown sentiment value', 'y', 'great', 'sentiment must be pos, neg or neu, found "great"'],
    ['a sentiment on an irrelevant item', 'n', 'neg', 'has a sentiment but is labelled not relevant'],
    ['a sentiment without a relevance label', '', 'pos', 'has a sentiment but no relevant label'],
  ])('rejects %s, naming the item', (_case, relevant, sentiment, problem) => {
    const id = SET.items[0]?.id;
    const sheet = fillMarkdown(renderLabellingSheetMarkdown(firstItems(1)), id, relevant, sentiment);

    expect(() => parseLabellingSheetMarkdown(sheet, 'sheet.md')).toThrow(`${id}: ${problem}`);
  });

  it('reports every problem at once', () => {
    const [a, b] = SET.items.map((item) => item.id) as [string, string];
    let sheet = renderLabellingSheetMarkdown(firstItems(2));
    sheet = fillMarkdown(sheet, a, 'x', '');
    sheet = fillMarkdown(sheet, b, 'n', 'pos');

    try {
      parseLabellingSheetMarkdown(sheet, 'sheet.md');
      throw new Error('expected InvalidLabellingSheet');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidLabellingSheet);
      expect((error as InvalidLabellingSheet).problems).toHaveLength(2);
    }
  });

  it('rejects an id listed twice', () => {
    const sheet = renderLabellingSheetMarkdown({ ...SET, items: [SET.items[0], SET.items[0]] as ValidationSet['items'] });

    expect(() => parseLabellingSheetMarkdown(sheet, 'sheet.md')).toThrow('listed more than once');
  });

  it('rejects a sheet without a table or without the label columns', () => {
    expect(() => parseLabellingSheetMarkdown('# nothing here', 'sheet.md')).toThrow('no table found');
    expect(() => parseLabellingSheetCsv('id,title\nx,y\n', 'sheet.csv')).toThrow('the header has no "relevant" column');
    expect(() => parseLabellingSheetCsv('', 'sheet.csv')).toThrow('the file is empty');
  });
});

describe('the committed labelling sheets', () => {
  const ids = SET.items.map((item) => item.id);

  it('list exactly the items of the validation set', () => {
    const markdown = readFileSync(join(REPO, 'docs', 'validation', 'labelling-sheet.md'), 'utf8');
    const csv = readFileSync(join(REPO, 'docs', 'validation', 'labelling-sheet.csv'), 'utf8');

    for (const sheet of [parseLabellingSheetMarkdown(markdown, 'md'), parseLabellingSheetCsv(csv, 'csv')]) {
      expect([...sheet.labels.map((label) => label.id), ...sheet.unlabelled].sort()).toEqual([...ids].sort());
    }
  });
});
