// Re-records the Google News fixtures under test/fixtures/google-news/ from the
// live feed (ADR-006: test data is recorded, never hand-written).
//
//   npm run fixtures:google-news
//   node scripts/record-google-news-fixtures.mjs --manifest <dir>/manifest.json
//
// `--manifest` records the feeds another manifest lists into that manifest's
// directory (e.g. the classifier validation feeds, #18); its `publisherUrl`
// section is optional.
// Every search URL comes from manifest.json, which the unit tests check against
// the query builder, so a recorded feed always answers the request the code
// really makes. After re-recording, run `npm test`: assertions that depend on
// the recorded content (counts, a sample item) may need updating.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

const { values: args } = parseArgs({ options: { manifest: { type: 'string' } } });
const manifestPath = args.manifest
  ? resolve(args.manifest)
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'google-news', 'manifest.json');
const fixturesDir = dirname(manifestPath);
const GOOGLE_NEWS = 'https://news.google.com';
const PAUSE_MS = 1500;
const TIMEOUT_MS = 15000;
const EDITION_PARAMS = {
  'en-US': { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  'he-IL': { hl: 'he', gl: 'IL', ceid: 'IL:he' },
};

const pause = () => new Promise((done) => setTimeout(done, PAUSE_MS));

async function fetchText(url, init = {}) {
  if (new URL(url).origin !== GOOGLE_NEWS) {
    throw new Error(`Refusing to fetch ${url}: only ${GOOGLE_NEWS} is recorded`);
  }
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} answered HTTP ${response.status}`);
  }
  return response.text();
}

function firstArticleId(xml) {
  const match = /<link>https:\/\/news\.google\.com\/rss\/articles\/([A-Za-z0-9_-]+)/.exec(xml);
  if (!match) throw new Error('The feed has no article link to record a publisher URL for');
  return match[1];
}

function decodeRequestBody(id, edition, timestamp, signature) {
  const inner = JSON.stringify([
    'garturlreq',
    [['X', 'X', ['X', 'X'], null, null, 1, 1, EDITION_PARAMS[edition].ceid, null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    id,
    Number(timestamp),
    signature,
  ]);
  return new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', inner, null, 'generic']]]) }).toString();
}

function resolvedUrlFrom(responseText) {
  const match = /"garturlres\\",\\"([^\\"]+)\\"/.exec(responseText);
  if (!match) throw new Error('The decode response carries no publisher URL');
  return match[1];
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

for (const feed of manifest.feeds) {
  const xml = await fetchText(feed.url);
  await writeFile(join(fixturesDir, feed.file), xml);
  console.log(`${feed.file}: ${(xml.match(/<item>/g) ?? []).length} items`);
  await pause();
}

const publisher = manifest.publisherUrl;
if (publisher === undefined) {
  manifest.recordedAt = new Date().toISOString();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.exit(0);
}
const feedXml = await readFile(join(fixturesDir, publisher.feedFile), 'utf8');
const id = firstArticleId(feedXml);
const params = new URLSearchParams(EDITION_PARAMS[publisher.edition]);
const page = await fetchText(`${GOOGLE_NEWS}/rss/articles/${id}?${params}`);
const timestamp = /data-n-a-ts="(\d+)"/.exec(page)?.[1];
const signature = /data-n-a-sg="([A-Za-z0-9_-]+)"/.exec(page)?.[1];
if (!timestamp || !signature) throw new Error('The article page carries no decode signature');
await writeFile(join(fixturesDir, publisher.pageFile), gzipSync(page));
await pause();
const decoded = await fetchText(`${GOOGLE_NEWS}/_/DotsSplashUi/data/batchexecute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  body: decodeRequestBody(id, publisher.edition, timestamp, signature),
});
await writeFile(join(fixturesDir, publisher.decodeResponseFile), decoded);
publisher.googleArticleId = id;
publisher.resolvedUrl = resolvedUrlFrom(decoded);
console.log(`publisher URL of ${id.slice(0, 16)}…: ${publisher.resolvedUrl}`);

manifest.recordedAt = new Date().toISOString();
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
