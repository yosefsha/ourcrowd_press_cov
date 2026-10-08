import type { Sentiment } from '../../domain/sentiment';
import type { ValidationItem, ValidationSet } from './validation-set';

/**
 * The labelling sheet a human fills in for the validation set, as Markdown
 * (`docs/validation/labelling-sheet.md`) and as a CSV twin for spreadsheets.
 * It never shows a model verdict, so the labels are not anchored by one.
 */

/** A human's label for one item; `sentiment` is null for an irrelevant item or one not yet labelled. */
export interface HumanLabel {
  readonly id: string;
  readonly relevant: boolean;
  readonly sentiment: Sentiment | null;
}

/** The labels read from a sheet, and the ids nobody has labelled yet. */
export interface SheetLabels {
  readonly labels: readonly HumanLabel[];
  readonly unlabelled: readonly string[];
}

export class InvalidLabellingSheet extends Error {
  constructor(
    source: string,
    readonly problems: readonly string[],
  ) {
    super(`Cannot read the labels in ${source}:\n- ${problems.join('\n- ')}`);
    this.name = 'InvalidLabellingSheet';
  }
}

const RELEVANT_HEADER = 'relevant (y/n)';
const SENTIMENT_HEADER = 'sentiment (pos/neg/neu, only if relevant)';
const COLUMNS = ['id', 'company', 'title', 'outlet', 'date', 'link', 'snippet', RELEVANT_HEADER, SENTIMENT_HEADER] as const;
const UTF8_BOM = '﻿';

function companyCell(item: ValidationItem): string {
  const { displayName, aliases, domain, description } = item.company;
  const extras = [
    aliases.length > 0 ? `aka ${aliases.join(', ')}` : null,
    domain,
    description,
  ].filter((part): part is string => part !== null && part.trim() !== '');
  return extras.length > 0 ? `${displayName} (${extras.join('; ')})` : displayName;
}

/** Shown instead of a snippet that only repeats the headline, as Google News snippets mostly do. */
const SAME_AS_TITLE = '(same as title)';

function sameText(a: string, b: string): boolean {
  const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim().toLowerCase();
  return normalize(a) === normalize(b);
}

function rowValues(item: ValidationItem): string[] {
  return [
    item.id,
    companyCell(item),
    item.article.title,
    item.article.outlet,
    item.article.publishedAt.toISOString().slice(0, 10),
    item.article.url,
    sameText(item.article.snippet, item.article.title) ? SAME_AS_TITLE : item.article.snippet,
    '',
    '',
  ];
}

/**
 * One table cell: on one line, pipes and backslashes escaped, and `<`/`>` as
 * entities so feed text (untrusted) cannot inject HTML into the rendered sheet.
 */
function markdownCell(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** A URL safe as a Markdown link target: parentheses and spaces percent-encoded. */
function linkTarget(url: string): string {
  return url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
}

/** The blank Markdown sheet: instructions, then one table row per item. */
export function renderLabellingSheetMarkdown(set: ValidationSet): string {
  const header = `| ${COLUMNS.join(' | ')} |`;
  const divider = `|${COLUMNS.map(() => '---').join('|')}|`;
  const rows = set.items.map((item) => {
    const [id, company, title, outlet, date, url, snippet] = rowValues(item).map(markdownCell);
    return `| ${id} | ${company} | ${title} | ${outlet} | ${date} | [open](${linkTarget(url)}) | ${snippet} |  |  |`;
  });
  return [
    '# Classifier validation — labelling sheet',
    '',
    `${set.items.length} real Candidates from Google News (validation set built ${set.builtAt.toISOString().slice(0, 10)}, ` +
      '`backend/test/fixtures/validation/validation-set.json`). Fill in the last two columns of every row; ' +
      '`npm run eval:classifiers` reads them and scores the classifiers against them (#18).',
    '',
    '## How to label',
    '',
    '- **Company** is the OurCrowd portfolio company of that name (aliases and domain in brackets, as its Company Profile has them). ' +
      'Nothing else is shown about it, so judge with what you know of the portfolio company.',
    '- **relevant (y/n)**: `y` if the article is actually about that company (it is a subject of the story, not just a word match), otherwise `n`.',
    '- **sentiment (pos/neg/neu, only if relevant)**: the article\'s stance **toward the company**, not its overall tone. ' +
      'Leave it empty when `relevant` is `n`.',
    '- Google News snippets mostly repeat the headline (shown as "(same as title)"); open the link when the headline alone is not enough.',
    '- Leave a row entirely empty to skip it; skipped rows are reported as unlabelled. The model\'s verdicts are deliberately not shown here.',
    '- Prefer the spreadsheet? Fill `labelling-sheet.csv` instead and run `npm run eval:classifiers -- --labels ../docs/validation/labelling-sheet.csv`.',
    '',
    '## Items',
    '',
    header,
    divider,
    ...rows,
    '',
  ].join('\n');
}

/**
 * One CSV field. Feed text is untrusted, so a value a spreadsheet would run as
 * a formula (leading `=`, `+`, `-`, `@`, tab or CR) is prefixed with `'`.
 */
function csvField(value: string): string {
  const inert = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n']/.test(inert) ? `"${inert.replace(/"/g, '""')}"` : inert;
}

/** The blank CSV twin of the sheet (UTF-8 with a byte order mark, so spreadsheets show Hebrew). */
export function renderLabellingSheetCsv(set: ValidationSet): string {
  const lines = [COLUMNS, ...set.items.map(rowValues)].map((row) => row.map(csvField).join(','));
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}

/** Splits a Markdown table row on its unescaped pipes and unescapes each cell. */
function markdownCells(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '\\' && index + 1 < body.length) {
      current += body[index + 1];
      index += 1;
    } else if (char === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** RFC 4180 records: quoted fields may hold commas, quotes (doubled) and line breaks. */
function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.startsWith(UTF8_BOM) ? text.slice(1) : text;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((row) => row.some((cell) => cell.trim() !== ''));
}

function readRelevant(value: string): boolean | null | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === '') return null;
  if (['y', 'yes', 'true'].includes(normalized)) return true;
  if (['n', 'no', 'false'].includes(normalized)) return false;
  return undefined;
}

function readSentiment(value: string): Sentiment | null | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === '') return null;
  if (['pos', 'positive', '+'].includes(normalized)) return 'positive';
  if (['neg', 'negative', '-'].includes(normalized)) return 'negative';
  if (['neu', 'neutral', '0'].includes(normalized)) return 'neutral';
  return undefined;
}

/** Turns the (id, relevant, sentiment) cells of every row into labels, collecting every problem. */
function labelsFromRows(rows: readonly { id: string; relevant: string; sentiment: string }[], source: string): SheetLabels {
  const problems: string[] = [];
  const labels: HumanLabel[] = [];
  const unlabelled: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.id === '') {
      problems.push('a row has no id');
      continue;
    }
    if (seen.has(row.id)) problems.push(`${row.id}: listed more than once`);
    seen.add(row.id);
    const relevant = readRelevant(row.relevant);
    const sentiment = readSentiment(row.sentiment);
    if (relevant === undefined) problems.push(`${row.id}: relevant must be y or n, found "${row.relevant}"`);
    if (sentiment === undefined) problems.push(`${row.id}: sentiment must be pos, neg or neu, found "${row.sentiment}"`);
    if (relevant === undefined || sentiment === undefined) continue;
    if (relevant === null) {
      if (sentiment !== null) problems.push(`${row.id}: has a sentiment but no relevant label`);
      else unlabelled.push(row.id);
    } else if (!relevant && sentiment !== null) {
      problems.push(`${row.id}: has a sentiment but is labelled not relevant`);
    } else {
      labels.push({ id: row.id, relevant, sentiment });
    }
  }
  if (problems.length > 0) throw new InvalidLabellingSheet(source, problems);
  return { labels, unlabelled };
}

function columnIndexes(header: readonly string[], source: string): { id: number; relevant: number; sentiment: number } {
  const find = (prefix: string): number => header.findIndex((cell) => cell.trim().toLowerCase().startsWith(prefix));
  const indexes = { id: find('id'), relevant: find('relevant'), sentiment: find('sentiment') };
  const missing = Object.entries(indexes)
    .filter(([, index]) => index < 0)
    .map(([name]) => `the header has no "${name}" column`);
  if (missing.length > 0) throw new InvalidLabellingSheet(source, missing);
  return indexes;
}

/** Reads the labels from the Markdown sheet's items table. */
export function parseLabellingSheetMarkdown(text: string, source: string): SheetLabels {
  const tableLines = text.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  const [headerLine, , ...rowLines] = tableLines;
  if (headerLine === undefined) throw new InvalidLabellingSheet(source, ['no table found']);
  const columns = columnIndexes(markdownCells(headerLine), source);
  const rows = rowLines.map(markdownCells).map((cells) => ({
    id: cells[columns.id] ?? '',
    relevant: cells[columns.relevant] ?? '',
    sentiment: cells[columns.sentiment] ?? '',
  }));
  return labelsFromRows(rows, source);
}

/** Reads the labels from the CSV twin of the sheet. */
export function parseLabellingSheetCsv(text: string, source: string): SheetLabels {
  const [header, ...records] = csvRecords(text);
  if (header === undefined) throw new InvalidLabellingSheet(source, ['the file is empty']);
  const columns = columnIndexes(header, source);
  const rows = records.map((cells) => ({
    id: (cells[columns.id] ?? '').trim(),
    relevant: cells[columns.relevant] ?? '',
    sentiment: cells[columns.sentiment] ?? '',
  }));
  return labelsFromRows(rows, source);
}
