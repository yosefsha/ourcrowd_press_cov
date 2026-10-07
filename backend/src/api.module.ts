import { Module } from '@nestjs/common';

import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

/**
 * Root module of the HTTP API (`node dist/main.js`). It serves reads, edits and
 * enqueues only: nothing reachable from here may import the news, classification,
 * pipeline or other collector-only code — `npm run lint:boundaries` enforces it.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule],
})
export class ApiModule {}
