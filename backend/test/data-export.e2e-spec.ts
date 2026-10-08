import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { configuration } from '../src/config/configuration';
import { DATA_EXPORTER, type DataExporter } from '../src/data-export/data-exporter';
import { EXPORT_FILE_NAMES } from '../src/data-export/export-format';
import { ImportDataModule } from '../src/data-export/import-data.module';
import { UnsupportedSchemaVersion } from '../src/data-export/parse-export';
import { SnapshotImporter } from '../src/data-export/snapshot-importer';
import { StoreNotEmpty } from '../src/data-export/snapshot-store';
import { buildTypeOrmOptions } from '../src/database/typeorm-options';
import type { FoundArticle } from '../src/domain/article';
import {
  MORPHISEC_AI_TRUST,
  MORPHISEC_ROGUEPLANET,
  ONCOHOST_B7NET,
  ONCOHOST_ICE,
  ZUTACORE_ALLEYWATCH,
  ZUTACORE_DCD_OPTIONS,
  ZUTACORE_SILICONANGLE,
} from './fixtures/recorded-google-news';

/**
 * The export round trip against real Postgres (ADR-005): export → import into
 * an empty database → export gives the same files apart from `exportedAt`.
 * Each test database is created from scratch and migrated, so the suite never
 * depends on — or disturbs — the shared database the other suites use.
 */

const SNAPSHOT_TABLES = [
  'tracked_companies',
  'articles',
  'runs',
  'run_company_errors',
  'candidates',
  'alert_digests',
  'alert_digest_items',
];

function urlFor(database: string): string {
  const url = new URL(configuration().database.url);
  url.pathname = `/${database}`;
  return url.toString();
}

async function createMigratedDatabase(admin: DataSource, name: string): Promise<DataSource> {
  await admin.query(`CREATE DATABASE "${name}"`);
  const dataSource = await new DataSource(buildTypeOrmOptions(urlFor(name))).initialize();
  await dataSource.runMigrations();
  return dataSource;
}

/** The Nest wiring `import-data` and the collector use, pointed at one database and export folder. */
async function exportContext(database: string, dir: string): Promise<INestApplicationContext> {
  process.env.DATABASE_URL = urlFor(database);
  process.env.DATA_EXPORT_DIR = dir;
  return NestFactory.createApplicationContext(ImportDataModule, { logger: false });
}

async function withContext<T>(database: string, dir: string, use: (context: INestApplicationContext) => Promise<T>): Promise<T> {
  const context = await exportContext(database, dir);
  try {
    return await use(context);
  } finally {
    await context.close();
  }
}

async function rowCounts(dataSource: DataSource): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of SNAPSHOT_TABLES) {
    const [row] = await dataSource.query<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${table}"`);
    counts[table] = row.n;
  }
  return counts;
}

/**
 * Fills a database the way the pipeline would — ids and timestamps generated
 * by Postgres (microsecond `now()`) — around recorded Google News articles.
 * Verdicts are explicit; they should switch to #6's recorded verdicts later.
 */
async function seed(dataSource: DataSource): Promise<void> {
  const one = async (sql: string, parameters: unknown[] = []): Promise<number> => {
    const [row] = await dataSource.query<{ id: number }[]>(sql, parameters);
    return row.id;
  };
  const company = (sourceName: string, status: string, extra: { domain?: string; reviewReason?: string; capped?: boolean; aliases?: string[] } = {}): Promise<number> =>
    one(
      `INSERT INTO tracked_companies (source_name, display_name, aliases, domain, description, search_terms, status, review_reason, coverage_capped)
       VALUES ($1, $1, $2, $3, NULL, $4, $5, $6, $7) RETURNING id`,
      [sourceName, extra.aliases ?? [], extra.domain ?? null, [`"${sourceName}"`], status, extra.reviewReason ?? null, extra.capped ?? false],
    );
  const run = (type: string, status: string, trigger: string, params: object, progress: object | null): Promise<number> =>
    one(
      `INSERT INTO runs (type, status, params, trigger, progress, started_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING id`,
      [type, status, JSON.stringify(params), trigger, progress === null ? null : JSON.stringify(progress)],
    );
  const article = (found: FoundArticle): Promise<number> =>
    one(
      `INSERT INTO articles (google_article_id, title, snippet, outlet_name, outlet_url, google_url, publisher_url, published_at, language, edition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [found.googleArticleId, found.title, found.snippet, found.outletName, found.outletUrl, found.googleUrl, found.publisherUrl, found.publishedAt, found.language, found.edition],
    );
  const mention = (articleId: number, companyId: number, runId: number, sentiment: string, reason: string): Promise<number> =>
    one(
      `INSERT INTO candidates (article_id, company_id, fetched_in_run_id, relevance, relevance_method, relevance_reason, relevance_classified_at,
                               sentiment, sentiment_reason, sentiment_classified_at, confirmed_in_run_id, confirmed_at)
       VALUES ($1, $2, $3, 'relevant', 'llm', $4, now(), $5, $6, now(), $3, now()) RETURNING id`,
      [articleId, companyId, runId, reason, sentiment, `Judged ${sentiment}`],
    );
  const rejected = (articleId: number, companyId: number, runId: number, method: string, reason: string): Promise<number> =>
    one(
      `INSERT INTO candidates (article_id, company_id, fetched_in_run_id, relevance, relevance_method, relevance_reason, relevance_classified_at)
       VALUES ($1, $2, $3, 'rejected', $4, $5, now()) RETURNING id`,
      [articleId, companyId, runId, method, reason],
    );

  const zutaCore = await company('ZutaCore', 'active', { domain: 'zutacore.com' });
  const morphisec = await company('Morphisec', 'active', { capped: true });
  const oncoHost = await company('OncoHost', 'active', { aliases: ['Onco Host'] });
  await company('Harvey', 'needs_review', { reviewReason: 'A common name; most news about "Harvey" is unrelated' });
  await dataSource.query(`INSERT INTO tracked_companies (display_name, status) VALUES ('Island', 'deactivated')`);

  const params = { until: null, companyIds: null, reprocess: false };
  const progress = { companiesTotal: 3, companiesDone: 3, candidatesFound: 4, candidatesClassified: 4, mentionsConfirmed: 2, companyErrors: 1, currentCompany: null };
  const backfill = await run('backfill', 'completed_with_errors', 'dashboard', { ...params, until: '2026-10-05' }, progress);
  await dataSource.query(`INSERT INTO run_company_errors (run_id, company_id, stage, message) VALUES ($1, $2, 'collection', $3)`, [
    backfill,
    morphisec,
    'Google News RSS responded with HTTP 503',
  ]);
  const daily1 = await run('daily_check', 'completed', 'schedule', params, null);
  const daily2 = await run('daily_check', 'completed', 'schedule', { ...params, companyIds: [morphisec] }, progress);

  await mention(await article(ZUTACORE_SILICONANGLE), zutaCore, backfill, 'positive', 'Reports ZutaCore raising a $100M round');
  await rejected(await article(ZUTACORE_ALLEYWATCH), zutaCore, backfill, 'llm', 'A roundup of many funding rounds');
  await mention(await article(ONCOHOST_ICE), oncoHost, backfill, 'positive', 'Discusses OncoHost');
  await rejected(await article(ONCOHOST_B7NET), oncoHost, backfill, 'name_absent', 'The text never names OncoHost');
  const partnership = await mention(await article(ZUTACORE_DCD_OPTIONS), zutaCore, daily1, 'positive', 'A ZutaCore partnership');
  const research = await mention(await article(MORPHISEC_AI_TRUST), morphisec, daily2, 'neutral', 'Morphisec research');
  await dataSource.query(`INSERT INTO candidates (article_id, company_id, fetched_in_run_id) VALUES ($1, $2, $3)`, [
    await article(MORPHISEC_ROGUEPLANET),
    morphisec,
    daily2,
  ]);

  const acknowledged = await one(`INSERT INTO alert_digests (run_id, acknowledged_at) VALUES ($1, now()) RETURNING id`, [daily1]);
  await dataSource.query(`INSERT INTO alert_digest_items (digest_id, candidate_id) VALUES ($1, $2)`, [acknowledged, partnership]);
  const open = await one(`INSERT INTO alert_digests (run_id) VALUES ($1) RETURNING id`, [daily2]);
  await dataSource.query(`INSERT INTO alert_digest_items (digest_id, candidate_id) VALUES ($1, $2)`, [open, research]);
}

async function readExport(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const name of Object.values(EXPORT_FILE_NAMES)) files[name] = await readFile(join(dir, name), 'utf8');
  return files;
}

/** The export with its `exportedAt` stamps blanked — the only thing allowed to differ. */
function withoutExportedAt(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([name, content]) => [
      name,
      content.replace(/"exportedAt": "[^"]+"/g, '"exportedAt": "<ignored>"'),
    ]),
  );
}

describe('data export and import-data (against Postgres)', () => {
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
  const source = `export_source_${suffix}`;
  const target = `export_target_${suffix}`;
  const spare = `export_spare_${suffix}`;
  const originalEnv = { DATABASE_URL: process.env.DATABASE_URL, DATA_EXPORT_DIR: process.env.DATA_EXPORT_DIR };
  let admin: DataSource;
  let sourceDb: DataSource;
  let targetDb: DataSource;
  let spareDb: DataSource;
  let workDir: string;
  let firstExport: string;
  let secondExport: string;

  beforeAll(async () => {
    admin = await new DataSource(buildTypeOrmOptions(configuration().database.url)).initialize();
    sourceDb = await createMigratedDatabase(admin, source);
    targetDb = await createMigratedDatabase(admin, target);
    spareDb = await createMigratedDatabase(admin, spare);
    workDir = await mkdtemp(join(tmpdir(), 'data-export-e2e-'));
    firstExport = join(workDir, 'first');
    secondExport = join(workDir, 'second');
    await seed(sourceDb);
  }, 60_000);

  afterAll(async () => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const dataSource of [sourceDb, targetDb, spareDb]) await dataSource?.destroy();
    for (const name of [source, target, spare]) await admin?.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin?.destroy();
    if (workDir !== undefined) await rm(workDir, { recursive: true, force: true });
  });

  it('round-trips: export, import into an empty database, export again gives the same files', async () => {
    // A running collector's heartbeat is not data and does not block the import.
    await targetDb.query(`INSERT INTO collector_heartbeat (last_seen_at, state) VALUES (now(), 'idle')`);

    await withContext(source, firstExport, (context) => context.get<DataExporter>(DATA_EXPORTER).exportAll());
    const summary = await withContext(target, firstExport, (context) => context.get(SnapshotImporter).importSnapshot());
    await withContext(target, secondExport, (context) => context.get<DataExporter>(DATA_EXPORTER).exportAll());

    expect(summary.counts).toEqual({
      companies: 5,
      articles: 7,
      candidates: 7,
      mentions: 4,
      runs: 3,
      runCompanyErrors: 1,
      alertDigests: 2,
      alertDigestItems: 2,
    });
    const first = await readExport(firstExport);
    const second = await readExport(secondExport);
    expect(withoutExportedAt(second)).toEqual(withoutExportedAt(first));
    expect(await rowCounts(targetDb)).toEqual(await rowCounts(sourceDb));
    // Microsecond timestamps survive (a JavaScript Date would truncate them to milliseconds).
    expect(first['candidates.json']).toMatch(/"createdAt": "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z"/);
  });

  it('writes the export atomically: only the export files, no temporary files', async () => {
    expect((await readdir(firstExport)).sort()).toEqual(Object.values(EXPORT_FILE_NAMES).sort());
  });

  it('moves every identity sequence past the imported ids', async () => {
    const runner = targetDb.createQueryRunner();
    await runner.startTransaction();
    try {
      const [run] = (await runner.query(
        `INSERT INTO runs (type, params, trigger, status) VALUES ('daily_check', '{}', 'dashboard', 'failed') RETURNING id`,
      )) as { id: number }[];
      const [company] = (await runner.query(
        `INSERT INTO tracked_companies (display_name, status) VALUES ('After import', 'active') RETURNING id`,
      )) as { id: number }[];
      const [{ max_run: maxRun, max_company: maxCompany }] = (await runner.query(
        `SELECT (SELECT max(id) FROM runs WHERE id <> $1) AS max_run, (SELECT max(id) FROM tracked_companies WHERE id <> $2) AS max_company`,
        [run.id, company.id],
      )) as { max_run: number; max_company: number }[];

      expect(run.id).toBe(maxRun + 1);
      expect(company.id).toBe(maxCompany + 1);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('refuses a database that already holds data, with a clear message, and changes nothing', async () => {
    const before = await rowCounts(sourceDb);

    const failure = withContext(source, firstExport, (context) => context.get(SnapshotImporter).importSnapshot());

    await expect(failure).rejects.toBeInstanceOf(StoreNotEmpty);
    await expect(failure).rejects.toThrow(
      /^The database already holds data \(tracked_companies, articles, runs, run_company_errors, candidates, alert_digests, alert_digest_items\); import-data only loads into an empty database and never merges\.$/,
    );
    expect(await rowCounts(sourceDb)).toEqual(before);
  });

  it('refuses even when only one table holds data', async () => {
    await spareDb.query(`INSERT INTO runs (type, params, trigger, status) VALUES ('backfill', '{}', 'dashboard', 'failed')`);
    try {
      await expect(
        withContext(spare, firstExport, (context) => context.get(SnapshotImporter).importSnapshot()),
      ).rejects.toThrow(new StoreNotEmpty(['runs']));
      expect((await rowCounts(spareDb)).tracked_companies).toBe(0);
    } finally {
      await spareDb.query('TRUNCATE runs CASCADE');
    }
  });

  it('rejects an unknown schemaVersion and leaves the empty database empty', async () => {
    const future = join(workDir, 'future');
    await cp(firstExport, future, { recursive: true });
    const manifestPath = join(future, EXPORT_FILE_NAMES.manifest);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    await writeFile(manifestPath, JSON.stringify({ ...manifest, schemaVersion: 2 }));

    await expect(
      withContext(spare, future, (context) => context.get(SnapshotImporter).importSnapshot()),
    ).rejects.toThrow(new UnsupportedSchemaVersion(2));
    expect(Object.values(await rowCounts(spareDb)).every((count) => count === 0)).toBe(true);
  });

  it('rolls the whole import back when Postgres rejects part of it', async () => {
    const broken = join(workDir, 'broken');
    await cp(firstExport, broken, { recursive: true });
    const companiesPath = join(broken, EXPORT_FILE_NAMES.companies);
    const companies = JSON.parse(await readFile(companiesPath, 'utf8')) as { profile: { displayName: string } }[];
    // Two live companies with the same display name violate UQ_tracked_companies_display_name_live.
    companies[1].profile.displayName = companies[0].profile.displayName;
    await writeFile(companiesPath, JSON.stringify(companies));

    await expect(
      withContext(spare, broken, (context) => context.get(SnapshotImporter).importSnapshot()),
    ).rejects.toMatchObject({ name: 'SnapshotRejected' });
    expect(Object.values(await rowCounts(spareDb)).every((count) => count === 0)).toBe(true);
  });
});
