import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ClassificationModule } from '../../classification/classification.module';
import { DataExportModule } from '../../data-export/data-export.module';
import { PipelineModule } from '../../pipeline/pipeline.module';
import { RunsModule } from '../runs.module';
import { CollectorActivity } from './collector-activity';
import { CollectorHeartbeatService } from './collector-heartbeat.service';
import { DailyCheckScheduler } from './daily-check.scheduler';
import { RunWorker } from './run-worker.service';

/**
 * The collector's Run loop, daily-check cron and heartbeat: claims queued Runs
 * and hands each to the `RunExecutor` for its type. Collector only.
 *
 * Consumes `RUN_EXECUTORS` (PipelineModule), `DATA_EXPORTER` (DataExportModule)
 * and `CLASSIFIER_HEALTH` (ClassificationModule) through their exports.
 */
@Module({
  imports: [ScheduleModule.forRoot(), RunsModule, PipelineModule, DataExportModule, ClassificationModule],
  providers: [CollectorActivity, RunWorker, CollectorHeartbeatService, DailyCheckScheduler],
})
export class RunWorkerModule {}
