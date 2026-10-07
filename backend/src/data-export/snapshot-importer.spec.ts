import { EXPORT_SCENARIO } from '../../test/fixtures/export-scenario';
import { EXPORT_FILE_NAMES, type ExportFileName, type Snapshot } from './export-format';
import { ExportFileMissing } from './export-folder';
import { JsonDataExporter } from './json.data-exporter';
import { InvalidExport, UnsupportedSchemaVersion } from './parse-export';
import { InMemoryExportFolder } from './repositories/in-memory.export-folder';
import { InMemorySnapshotStore } from './repositories/in-memory.snapshot-store';
import { SnapshotImporter } from './snapshot-importer';
import { StoreNotEmpty, type SnapshotLoader } from './snapshot-store';

const clock = { now: () => new Date('2026-10-07T09:00:00.000Z') };

async function exportedFolder(snapshot: Snapshot = EXPORT_SCENARIO): Promise<InMemoryExportFolder> {
  const folder = new InMemoryExportFolder();
  await new JsonDataExporter(new InMemorySnapshotStore(snapshot), folder, clock, 'Asia/Jerusalem').exportAll();
  return folder;
}

/** Rewrites one JSON file of an export. */
async function edit(folder: InMemoryExportFolder, name: ExportFileName, change: (value: unknown) => unknown): Promise<void> {
  const current = JSON.parse(folder.peek(name) ?? 'null') as unknown;
  await folder.replaceFiles([{ name, content: JSON.stringify(change(current)) }]);
}

/** A loader that records whether it was reached. */
function spyLoader(): SnapshotLoader & { calls: number } {
  return {
    calls: 0,
    loadIntoEmptyStore(): Promise<void> {
      this.calls += 1;
      return Promise.resolve();
    },
  };
}

describe('SnapshotImporter', () => {
  it('loads an export into an empty store exactly as it was exported', async () => {
    const store = new InMemorySnapshotStore();

    const summary = await new SnapshotImporter(await exportedFolder(), store).importSnapshot();

    await expect(store.readSnapshot()).resolves.toEqual(EXPORT_SCENARIO);
    expect(summary.exportedAt).toBe('2026-10-07T09:00:00.000Z');
    expect(summary.counts).toMatchObject({ companies: 4, articles: 7, candidates: 7, runs: 3, alertDigests: 2 });
  });

  it('refuses a store that already holds data and leaves it unchanged', async () => {
    const existing: Snapshot = { ...EXPORT_SCENARIO, companies: EXPORT_SCENARIO.companies.slice(0, 1) };
    const store = new InMemorySnapshotStore(existing);

    await expect(new SnapshotImporter(await exportedFolder(), store).importSnapshot()).rejects.toBeInstanceOf(
      StoreNotEmpty,
    );
    await expect(store.readSnapshot()).resolves.toBe(existing);
  });

  it.each([2, 0, '1', null])('rejects schemaVersion %j before reading anything else', async (version) => {
    const folder = await exportedFolder();
    await edit(folder, EXPORT_FILE_NAMES.manifest, (manifest) => ({ ...(manifest as object), schemaVersion: version }));
    await folder.replaceFiles([{ name: EXPORT_FILE_NAMES.companies, content: 'not json' }]);
    const loader = spyLoader();

    await expect(new SnapshotImporter(folder, loader).importSnapshot()).rejects.toThrow(UnsupportedSchemaVersion);
    expect(loader.calls).toBe(0);
  });

  it('rejects a manifest without a schemaVersion', async () => {
    const folder = await exportedFolder();
    await edit(folder, EXPORT_FILE_NAMES.manifest, () => ({ exportedAt: 'x' }));

    await expect(new SnapshotImporter(folder, spyLoader()).importSnapshot()).rejects.toThrow(
      'The export has schemaVersion undefined',
    );
  });

  it('reports a missing file', async () => {
    const loader = spyLoader();

    await expect(new SnapshotImporter(new InMemoryExportFolder(), loader).importSnapshot()).rejects.toBeInstanceOf(
      ExportFileMissing,
    );
    expect(loader.calls).toBe(0);
  });

  it('rejects files whose row counts differ from the manifest (a half-replaced export)', async () => {
    const folder = await exportedFolder();
    await edit(folder, EXPORT_FILE_NAMES.articles, (articles) => (articles as unknown[]).slice(1));
    const loader = spyLoader();

    await expect(new SnapshotImporter(folder, loader).importSnapshot()).rejects.toThrow(
      /articles: manifest 7, files 6/,
    );
    expect(loader.calls).toBe(0);
  });

  it('rejects a reference to a record that is not in the export', async () => {
    const folder = await exportedFolder();
    await edit(folder, EXPORT_FILE_NAMES.alertDigests, (digests) =>
      (digests as { candidateIds: number[] }[]).map((digest) => ({ ...digest, candidateIds: [99] })),
    );

    await expect(new SnapshotImporter(folder, spyLoader()).importSnapshot()).rejects.toThrow(
      'alert-digests.json digest 1 refers to a record that is not in the export',
    );
  });

  it('rejects duplicate ids', async () => {
    const folder = await exportedFolder();
    await edit(folder, EXPORT_FILE_NAMES.companies, (companies) =>
      (companies as { id: number }[]).map((company) => ({ ...company, id: 1 })),
    );

    await expect(new SnapshotImporter(folder, spyLoader()).importSnapshot()).rejects.toThrow(
      'companies.json has duplicate ids',
    );
  });

  it.each([
    [EXPORT_FILE_NAMES.companies, { status: 'archived' }, 'companies.json[0].status must be one of active, needs_review, deactivated'],
    [EXPORT_FILE_NAMES.articles, { publishedAt: '2026-06-02 07:00' }, 'articles.json[0].publishedAt must be a UTC timestamp'],
    [EXPORT_FILE_NAMES.candidates, { articleId: 1.5 }, 'candidates.json[0].articleId must be a positive integer'],
    [EXPORT_FILE_NAMES.runs, { params: { until: 'soon', companyIds: null, reprocess: false } }, 'params.until must be a YYYY-MM-DD date or null'],
    [EXPORT_FILE_NAMES.runs, { progress: { companiesTotal: -1 } }, 'runs.json[0].progress.companiesTotal must be a non-negative integer'],
  ] as const)('rejects a malformed field in %s', async (name, override, message) => {
    const folder = await exportedFolder();
    await edit(folder, name, (records) =>
      (records as object[]).map((record, index) => (index === 0 ? { ...record, ...override } : record)),
    );

    await expect(new SnapshotImporter(folder, spyLoader()).importSnapshot()).rejects.toThrow(new InvalidExport(message));
  });

  it('rejects a missing field', async () => {
    const folder = await exportedFolder();
    await edit(folder, EXPORT_FILE_NAMES.candidates, (records) =>
      (records as Record<string, unknown>[]).map(({ sentiment: _dropped, ...rest }) => rest),
    );

    await expect(new SnapshotImporter(folder, spyLoader()).importSnapshot()).rejects.toThrow(
      'candidates.json[0].sentiment is missing',
    );
  });

  it('rejects a file that is not JSON', async () => {
    const folder = await exportedFolder();
    await folder.replaceFiles([{ name: EXPORT_FILE_NAMES.runs, content: '[{' }]);

    await expect(new SnapshotImporter(folder, spyLoader()).importSnapshot()).rejects.toThrow(/runs\.json is not valid JSON/);
  });

  it('keeps unknown keys of a Run\'s JSON params rather than dropping them', async () => {
    const folder = await exportedFolder();
    await edit(folder, EXPORT_FILE_NAMES.runs, (runs) =>
      (runs as { params: object }[]).map((run) => ({ ...run, params: { ...run.params, note: 'kept' } })),
    );
    const store = new InMemorySnapshotStore();

    await new SnapshotImporter(folder, store).importSnapshot();

    expect((await store.readSnapshot()).runs[0].params).toEqual({
      until: null,
      companyIds: null,
      reprocess: false,
      note: 'kept',
    });
  });
});
