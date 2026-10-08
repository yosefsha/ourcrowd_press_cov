import { EXPORT_FILE_NAMES, countSnapshot, type SnapshotCounts } from './export-format';
import type { ExportFolder } from './export-folder';
import { parseManifest, parseSnapshot } from './parse-export';
import type { SnapshotLoader } from './snapshot-store';

/** What `import-data` loaded. */
export interface ImportSummary {
  readonly exportedAt: string;
  readonly counts: SnapshotCounts;
}

/**
 * Loads the `data/` export into an empty database (ADR-005, dev and
 * presentation only). The manifest is read first so a foreign schema version
 * is rejected before anything else; the files are fully validated before the
 * database is touched.
 */
export class SnapshotImporter {
  constructor(
    private readonly folder: ExportFolder,
    private readonly loader: SnapshotLoader,
  ) {}

  /**
   * Throws `UnsupportedSchemaVersion`, `InvalidExport`, `ExportFileMissing`,
   * `ExportFolderUnavailable`, `StoreNotEmpty`, `SnapshotRejected` or
   * `SnapshotStoreUnavailable`; on any of them the database is unchanged.
   */
  async importSnapshot(): Promise<ImportSummary> {
    const manifest = parseManifest(await this.folder.readFile(EXPORT_FILE_NAMES.manifest));
    const snapshot = parseSnapshot(manifest, {
      companies: await this.folder.readFile(EXPORT_FILE_NAMES.companies),
      articles: await this.folder.readFile(EXPORT_FILE_NAMES.articles),
      candidates: await this.folder.readFile(EXPORT_FILE_NAMES.candidates),
      runs: await this.folder.readFile(EXPORT_FILE_NAMES.runs),
      alertDigests: await this.folder.readFile(EXPORT_FILE_NAMES.alertDigests),
    });
    await this.loader.loadIntoEmptyStore(snapshot);
    return { exportedAt: manifest.exportedAt, counts: countSnapshot(snapshot) };
  }
}
