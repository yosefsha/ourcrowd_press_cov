import { EXPORT_FILE_NAMES, EXPORT_SCHEMA_VERSION, countSnapshot, type ExportManifest, type Snapshot } from '../export-format';
import type { ExportFile } from '../export-folder';
import { mentionStatusReport, mentionsCsv } from './human-readable';

/** Pretty-printed JSON with a trailing newline, so exports diff cleanly in review. */
function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Every file of the `data/` export for `snapshot`, rendered at `exportedAt`.
 * The manifest comes last: written last, it marks the export complete.
 */
export function renderExport(snapshot: Snapshot, exportedAt: Date, timeZone: string): readonly ExportFile[] {
  const manifest: ExportManifest = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    timeZone,
    counts: countSnapshot(snapshot),
  };
  return [
    { name: EXPORT_FILE_NAMES.companies, content: json(snapshot.companies) },
    { name: EXPORT_FILE_NAMES.articles, content: json(snapshot.articles) },
    { name: EXPORT_FILE_NAMES.candidates, content: json(snapshot.candidates) },
    { name: EXPORT_FILE_NAMES.runs, content: json(snapshot.runs) },
    { name: EXPORT_FILE_NAMES.alertDigests, content: json(snapshot.alertDigests) },
    { name: EXPORT_FILE_NAMES.mentionStatus, content: json(mentionStatusReport(snapshot, exportedAt, timeZone)) },
    { name: EXPORT_FILE_NAMES.mentionsCsv, content: mentionsCsv(snapshot, timeZone) },
    { name: EXPORT_FILE_NAMES.manifest, content: json(manifest) },
  ];
}
