import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { systemClock } from './clock';
import { DATA_EXPORTER, type DataExporter } from './data-exporter';
import { EXPORT_FOLDER, type ExportFolder } from './export-folder';
import { JsonDataExporter } from './json.data-exporter';
import { FileSystemExportFolder } from './repositories/file-system.export-folder';
import { PostgresSnapshotStore } from './repositories/postgres.snapshot-store';
import { SnapshotImporter } from './snapshot-importer';
import {
  SNAPSHOT_LOADER,
  SNAPSHOT_READER,
  type SnapshotLoader,
  type SnapshotReader,
} from './snapshot-store';

/**
 * The `data/` export (ADR-005): `DATA_EXPORTER`, called by the collector after
 * every Run, and `SnapshotImporter`, used by the `import-data` command.
 * Relies on the global config and the TypeORM connection of its root module.
 */
@Module({
  providers: [
    PostgresSnapshotStore,
    { provide: SNAPSHOT_READER, useExisting: PostgresSnapshotStore },
    { provide: SNAPSHOT_LOADER, useExisting: PostgresSnapshotStore },
    {
      provide: EXPORT_FOLDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): ExportFolder =>
        new FileSystemExportFolder(config.get('dataExport.dir', { infer: true })),
    },
    {
      provide: DATA_EXPORTER,
      inject: [SNAPSHOT_READER, EXPORT_FOLDER, ConfigService],
      useFactory: (
        reader: SnapshotReader,
        folder: ExportFolder,
        config: ConfigService<AppConfig, true>,
      ): DataExporter =>
        new JsonDataExporter(reader, folder, systemClock, config.get('schedule.timeZone', { infer: true })),
    },
    {
      provide: SnapshotImporter,
      inject: [EXPORT_FOLDER, SNAPSHOT_LOADER],
      useFactory: (folder: ExportFolder, loader: SnapshotLoader): SnapshotImporter =>
        new SnapshotImporter(folder, loader),
    },
  ],
  exports: [DATA_EXPORTER, SnapshotImporter],
})
export class DataExportModule {}
