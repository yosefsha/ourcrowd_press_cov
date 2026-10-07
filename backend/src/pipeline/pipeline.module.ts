import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AlertDeliveryModule } from '../alerts/notifiers/alert-delivery.module';
import { ClassificationModule } from '../classification/classification.module';
import { CompaniesModule } from '../companies/companies.module';
import type { AppConfig } from '../config/configuration';
import { NewsModule } from '../news/news.module';
import { RUN_EXECUTORS, type RunExecutor } from '../runs/run-executor';
import { BackfillExecutor } from './backfill.executor';
import { CANDIDATE_REPOSITORY } from './candidate.repository';
import { CLOCK, SystemClock } from './clock';
import { CompanyCollectionService } from './company-collection.service';
import { DailyCheckExecutor } from './daily-check.executor';
import { PIPELINE_SETTINGS, type PipelineSettings, pipelineSettingsFrom } from './pipeline-settings';
import { PostgresCandidateRepository } from './repositories/postgres.candidate.repository';
import { PostgresRunHistory } from './repositories/postgres.run-history';
import { RUN_HISTORY } from './run-history';

/**
 * The `RunExecutor` implementations: Backfill and Daily Check, exported as the
 * `RUN_EXECUTORS` list the Run worker dispatches on. Collector only.
 */
@Module({
  imports: [NewsModule, ClassificationModule, CompaniesModule, AlertDeliveryModule],
  providers: [
    {
      provide: PIPELINE_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): PipelineSettings =>
        pipelineSettingsFrom({
          news: config.get('news', { infer: true }),
          ollama: config.get('ollama', { infer: true }),
          schedule: config.get('schedule', { infer: true }),
        }),
    },
    { provide: CLOCK, useClass: SystemClock },
    { provide: CANDIDATE_REPOSITORY, useClass: PostgresCandidateRepository },
    { provide: RUN_HISTORY, useClass: PostgresRunHistory },
    CompanyCollectionService,
    BackfillExecutor,
    DailyCheckExecutor,
    {
      provide: RUN_EXECUTORS,
      inject: [BackfillExecutor, DailyCheckExecutor],
      useFactory: (backfill: BackfillExecutor, dailyCheck: DailyCheckExecutor): readonly RunExecutor[] => [
        backfill,
        dailyCheck,
      ],
    },
  ],
  exports: [RUN_EXECUTORS],
})
export class PipelineModule {}
