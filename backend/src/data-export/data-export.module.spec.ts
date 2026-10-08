import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppConfigModule } from '../config/app-config.module';
import { DataExportModule } from './data-export.module';
import { DATA_EXPORTER, type DataExporter } from './data-exporter';
import { JsonDataExporter } from './json.data-exporter';
import { SnapshotImporter } from './snapshot-importer';

/** Stands in for the TypeORM connection the root module provides; never queried here. */
@Global()
@Module({ providers: [{ provide: DataSource, useValue: {} }], exports: [DataSource] })
class FakeDatabaseModule {}

/** A module outside DataExportModule, as the Run worker (#8) will be. */
@Injectable()
class ExporterConsumer {
  constructor(@Inject(DATA_EXPORTER) readonly exporter: DataExporter) {}
}

@Module({ imports: [DataExportModule], providers: [ExporterConsumer] })
class ConsumerModule {}

describe('DataExportModule', () => {
  it('exports DATA_EXPORTER and SnapshotImporter to modules that import it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, FakeDatabaseModule, ConsumerModule],
    }).compile();

    expect(moduleRef.get(ExporterConsumer).exporter).toBeInstanceOf(JsonDataExporter);
    expect(moduleRef.get(SnapshotImporter, { strict: false })).toBeInstanceOf(SnapshotImporter);
  });
});
