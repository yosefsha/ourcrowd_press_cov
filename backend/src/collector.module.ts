import { Module } from '@nestjs/common';

import { CollectorLifecycle } from './collector/collector-lifecycle.service';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';

/**
 * Root module of the collector (`node dist/worker.js`): a Nest application
 * context with no HTTP listener, which executes Runs.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [CollectorLifecycle],
})
export class CollectorModule {}
