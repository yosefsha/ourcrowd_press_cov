import { EXPORT_SCENARIO } from '../../test/fixtures/export-scenario';
import type { Clock } from './clock';
import { DataExportFailed } from './data-exporter';
import { EXPORT_FILE_NAMES, EXPORT_SCHEMA_VERSION } from './export-format';
import { ExportFolderUnavailable, type ExportFile, type ExportFolder } from './export-folder';
import { JsonDataExporter } from './json.data-exporter';
import { InMemoryExportFolder } from './repositories/in-memory.export-folder';
import { InMemorySnapshotStore } from './repositories/in-memory.snapshot-store';
import { SnapshotStoreUnavailable, type SnapshotReader } from './snapshot-store';

const clock: Clock = { now: () => new Date('2026-10-07T09:00:00.000Z') };

function exporterWith(folder: ExportFolder, reader: SnapshotReader = new InMemorySnapshotStore(EXPORT_SCENARIO)): JsonDataExporter {
  return new JsonDataExporter(reader, folder, clock, 'Asia/Jerusalem');
}

describe('JsonDataExporter', () => {
  it('writes every export file, with the manifest last', async () => {
    const folder = new InMemoryExportFolder();

    await exporterWith(folder).exportAll();

    expect(folder.writeOrder).toEqual([
      'companies.json',
      'articles.json',
      'candidates.json',
      'runs.json',
      'alert-digests.json',
      'mention-status.json',
      'mentions.csv',
      'manifest.json',
    ]);
  });

  it('writes a versioned manifest with the export time and row counts', async () => {
    const folder = new InMemoryExportFolder();

    await exporterWith(folder).exportAll();

    expect(JSON.parse(folder.peek(EXPORT_FILE_NAMES.manifest) ?? '')).toEqual({
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: '2026-10-07T09:00:00.000Z',
      timeZone: 'Asia/Jerusalem',
      counts: {
        companies: 4,
        articles: 7,
        candidates: 7,
        mentions: 4,
        runs: 3,
        runCompanyErrors: 1,
        alertDigests: 2,
        alertDigestItems: 2,
      },
    });
  });

  it('writes the snapshot records as they are, including rejected Candidates and acknowledgements', async () => {
    const folder = new InMemoryExportFolder();

    await exporterWith(folder).exportAll();

    expect(JSON.parse(folder.peek(EXPORT_FILE_NAMES.candidates) ?? '')).toEqual(EXPORT_SCENARIO.candidates);
    expect(JSON.parse(folder.peek(EXPORT_FILE_NAMES.alertDigests) ?? '')).toEqual(EXPORT_SCENARIO.alertDigests);
    expect(JSON.parse(folder.peek(EXPORT_FILE_NAMES.runs) ?? '')).toEqual(EXPORT_SCENARIO.runs);
  });

  it('produces identical files for the same snapshot and time', async () => {
    const first = new InMemoryExportFolder();
    const second = new InMemoryExportFolder();

    await exporterWith(first).exportAll();
    await exporterWith(second).exportAll();

    for (const name of Object.values(EXPORT_FILE_NAMES)) expect(second.peek(name)).toBe(first.peek(name));
  });

  it('reports a store failure as DataExportFailed and writes nothing', async () => {
    const folder = new InMemoryExportFolder();
    const reader: SnapshotReader = {
      readSnapshot: () => Promise.reject(new SnapshotStoreUnavailable('connection refused')),
    };

    const failure: unknown = await exporterWith(folder, reader).exportAll().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DataExportFailed);
    expect((failure as DataExportFailed).cause).toBeInstanceOf(SnapshotStoreUnavailable);
    expect(folder.writeOrder).toEqual([]);
  });

  it('reports a folder failure as DataExportFailed', async () => {
    const folder: ExportFolder = {
      replaceFiles: (_files: readonly ExportFile[]) =>
        Promise.reject(new ExportFolderUnavailable('Cannot write the export to /app/data', { cause: new Error('EACCES') })),
      readFile: () => Promise.reject(new Error('unused')),
    };

    await expect(exporterWith(folder).exportAll()).rejects.toThrow(
      'Could not write the data export: Cannot write the export to /app/data: EACCES',
    );
  });
});
