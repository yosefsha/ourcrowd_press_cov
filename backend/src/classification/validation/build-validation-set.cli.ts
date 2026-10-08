/**
 * Builds the classifier validation set (#18) from recorded Google News feeds
 * and writes the blank labelling sheet. Run from `backend/`:
 *
 *   npm run fixtures:validation
 *
 * which first records the feeds listed in `test/fixtures/validation/feeds/
 * manifest.json` with `scripts/record-google-news-fixtures.mjs`, then runs this.
 * `test/fixtures/validation/selection.json` says how many Candidates to take
 * from each recorded feed (#5's feeds included). The sheet is never overwritten
 * once it holds a label.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { parseNewsEdition } from '../../domain/news-edition';
import { parseGoogleNewsRss } from '../../news/google-news/google-news-rss-parser';
import { isRecord } from '../prompts/prompt-parts';
import { readCompany } from '../recorded/recorded-verdicts';
import {
  parseLabellingSheetCsv,
  parseLabellingSheetMarkdown,
  renderLabellingSheetCsv,
  renderLabellingSheetMarkdown,
} from './labelling-sheet';
import { selectValidationItems, type FeedSelection } from './select-validation-items';
import { NAME_KINDS, serializeValidationSet, type NameKind, type ValidationSet } from './validation-set';
import { VALIDATION_PATHS } from './validation-paths';

interface PlannedFeed {
  readonly feed: string;
  readonly nameKind: NameKind;
  readonly pick: number;
}

function fail(message: string): never {
  throw new Error(message);
}

function readPlan(json: unknown, source: string): PlannedFeed[] {
  if (!isRecord(json) || !Array.isArray(json.feeds)) fail(`${source}: expected { "feeds": [...] }`);
  return json.feeds.map((entry: unknown, index: number) => {
    if (
      !isRecord(entry) ||
      typeof entry.feed !== 'string' ||
      !(NAME_KINDS as readonly unknown[]).includes(entry.nameKind) ||
      typeof entry.pick !== 'number' ||
      !Number.isInteger(entry.pick) ||
      entry.pick < 1
    ) {
      fail(`${source}: feed ${index} needs "feed", "nameKind" (${NAME_KINDS.join('/')}) and a positive "pick"`);
    }
    return { feed: entry.feed, nameKind: entry.nameKind as NameKind, pick: entry.pick };
  });
}

/** The manifest entry (#5's format) a recorded feed was searched with. */
async function loadFeed(fixturesDir: string, planned: PlannedFeed): Promise<FeedSelection> {
  const feedPath = join(fixturesDir, planned.feed);
  const manifestPath = join(dirname(feedPath), 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  const entry = isRecord(manifest) && Array.isArray(manifest.feeds)
    ? (manifest.feeds as unknown[]).find((feed) => isRecord(feed) && feed.file === basename(feedPath))
    : undefined;
  if (!isRecord(entry) || typeof entry.edition !== 'string' || !isRecord(entry.window)) {
    fail(`${manifestPath} does not list ${basename(feedPath)}`);
  }
  const profile = readCompany(entry.profile) ?? fail(`${manifestPath}: ${basename(feedPath)} has no valid profile`);
  const window = { from: new Date(String(entry.window.from)), to: new Date(String(entry.window.to)) };
  const edition = parseNewsEdition(entry.edition);
  const { articles } = parseGoogleNewsRss(await readFile(feedPath, 'utf8'), edition);
  return { sourceFeed: planned.feed, nameKind: planned.nameKind, pick: planned.pick, profile, window, articles };
}

/** True when a sheet at `path` already carries at least one label. */
async function hasLabels(path: string, parse: typeof parseLabellingSheetMarkdown): Promise<boolean> {
  if (!existsSync(path)) return false;
  return parse(await readFile(path, 'utf8'), path).labels.length > 0;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      selection: { type: 'string', default: VALIDATION_PATHS.selection },
      fixtures: { type: 'string', default: VALIDATION_PATHS.fixtures },
      out: { type: 'string', default: VALIDATION_PATHS.set },
      sheet: { type: 'string', default: VALIDATION_PATHS.sheetMarkdown },
      csv: { type: 'string', default: VALIDATION_PATHS.sheetCsv },
    },
  });
  const selectionPath = resolve(values.selection);
  const plan = readPlan(JSON.parse(await readFile(selectionPath, 'utf8')) as unknown, selectionPath);
  const feeds: FeedSelection[] = [];
  for (const planned of plan) {
    feeds.push(await loadFeed(resolve(values.fixtures), planned));
  }
  const { items, shortfalls } = selectValidationItems(feeds);
  for (const shortfall of shortfalls) {
    console.warn(`${shortfall.sourceFeed}: wanted ${shortfall.wanted}, only ${shortfall.eligible} eligible`);
  }
  const set: ValidationSet = { builtAt: new Date(), items };

  const sheetPath = resolve(values.sheet);
  const csvPath = resolve(values.csv);
  if ((await hasLabels(sheetPath, parseLabellingSheetMarkdown)) || (await hasLabels(csvPath, parseLabellingSheetCsv))) {
    fail(`The labelling sheet already holds labels (${sheetPath} or ${csvPath}); not rebuilding the set under them.`);
  }

  const outPath = resolve(values.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, serializeValidationSet(set), 'utf8');
  await mkdir(dirname(sheetPath), { recursive: true });
  await writeFile(sheetPath, renderLabellingSheetMarkdown(set), 'utf8');
  await writeFile(csvPath, renderLabellingSheetCsv(set), 'utf8');
  console.log(`Wrote ${items.length} items to ${outPath}, and blank sheets ${sheetPath} and ${csvPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
