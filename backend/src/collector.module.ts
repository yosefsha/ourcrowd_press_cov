import { Module } from '@nestjs/common';

import { AlertDeliveryModule } from './alerts/notifiers/alert-delivery.module';
import { ClassificationModule } from './classification/classification.module';
import { CollectorLifecycle } from './collector/collector-lifecycle.service';
import { CompaniesModule } from './companies/companies.module';
import { CompanyImportModule } from './companies/import/company-import.module';
import { AppConfigModule } from './config/app-config.module';
import { DataExportModule } from './data-export/data-export.module';
import { DatabaseModule } from './database/database.module';
import { NewsModule } from './news/news.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { RunsModule } from './runs/runs.module';
import { RunWorkerModule } from './runs/worker/run-worker.module';

/**
 * Root module of the collector (`node dist/worker.js`): a Nest application
 * context with no HTTP listener, which imports companies, collects news,
 * classifies it, executes Runs, raises Alert Digests and writes the export.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CompaniesModule,
    CompanyImportModule,
    NewsModule,
    ClassificationModule,
    RunsModule,
    RunWorkerModule,
    PipelineModule,
    AlertDeliveryModule,
    DataExportModule,
  ],
  providers: [CollectorLifecycle],
})
export class CollectorModule {}
