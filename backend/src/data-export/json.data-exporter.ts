import type { Clock } from './clock';
import { DataExportFailed, type DataExporter } from './data-exporter';
import type { ExportFolder } from './export-folder';
import { renderExport } from './render/render-export';
import type { SnapshotReader } from './snapshot-store';

/**
 * Writes the `data/` export (ADR-005): the full snapshot as versioned JSON plus
 * the human-friendly `mention-status.json` and `mentions.csv`.
 */
export class JsonDataExporter implements DataExporter {
  constructor(
    private readonly reader: SnapshotReader,
    private readonly folder: ExportFolder,
    private readonly clock: Clock,
    private readonly timeZone: string,
  ) {}

  async exportAll(): Promise<void> {
    try {
      const snapshot = await this.reader.readSnapshot();
      await this.folder.replaceFiles(renderExport(snapshot, this.clock.now(), this.timeZone));
    } catch (error) {
      throw new DataExportFailed(`Could not write the data export: ${describe(error)}`, { cause: error });
    }
  }
}

/** The error's message followed by its causes' (e.g. the filesystem error behind a folder failure). */
function describe(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (typeof current === 'object' && current !== null && messages.length < 5) {
    if ('message' in current && typeof current.message === 'string') messages.push(current.message);
    current = 'cause' in current ? current.cause : undefined;
  }
  return messages.length > 0 ? messages.join(': ') : String(error);
}
