import { NestFactory } from '@nestjs/core';

import { ExportFileMissing, ExportFolderUnavailable } from './export-folder';
import { ImportDataModule } from './import-data.module';
import { InvalidExport, UnsupportedSchemaVersion } from './parse-export';
import { SnapshotImporter, type ImportSummary } from './snapshot-importer';
import { SnapshotRejected, SnapshotStoreUnavailable, StoreNotEmpty } from './snapshot-store';

/**
 * `npm run import-data`: loads the `data/` export (DATA_EXPORT_DIR) into an
 * empty database, for development and presentation only (ADR-005). Refuses a
 * database that holds any data and an export of another schema version; on any
 * failure the database is left unchanged.
 */

const EXPECTED_FAILURES = [
  StoreNotEmpty,
  UnsupportedSchemaVersion,
  InvalidExport,
  ExportFileMissing,
  ExportFolderUnavailable,
  SnapshotRejected,
  SnapshotStoreUnavailable,
];

function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : '';
  const hint =
    error instanceof StoreNotEmpty
      ? '\nimport-data never merges. Load the snapshot into a fresh database: stop the stack, remove its Postgres volume, start it again and import before anything else writes to it.'
      : '';
  return `${error.message}${cause}${hint}`;
}

function describeSummary(summary: ImportSummary): string {
  const { counts } = summary;
  return (
    `Imported the export of ${summary.exportedAt}: ${counts.companies} companies, ${counts.articles} articles, ` +
    `${counts.candidates} candidates (${counts.mentions} mentions), ${counts.runs} runs, ` +
    `${counts.alertDigests} alert digests.\n`
  );
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    process.stderr.write(
      `import-data takes no arguments (got: ${args.join(' ')}). It reads the export in DATA_EXPORT_DIR.\n`,
    );
    return 2;
  }
  const app = await NestFactory.createApplicationContext(ImportDataModule, { logger: ['error', 'warn'] });
  try {
    const summary = await app.get(SnapshotImporter).importSnapshot();
    process.stdout.write(describeSummary(summary));
    return 0;
  } catch (error) {
    if (!EXPECTED_FAILURES.some((type) => error instanceof type)) throw error;
    process.stderr.write(`import-data failed: ${describeFailure(error)}\n`);
    return 1;
  } finally {
    await app.close();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`import-data failed unexpectedly: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  },
);
