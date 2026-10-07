import { Module } from '@nestjs/common';

import { AppConfigModule } from '../config/app-config.module';
import { DatabaseModule } from '../database/database.module';
import { DataExportModule } from './data-export.module';

/** Root module of the `import-data` command: config, Postgres and the export module only. */
@Module({
  imports: [AppConfigModule, DatabaseModule, DataExportModule],
})
export class ImportDataModule {}
