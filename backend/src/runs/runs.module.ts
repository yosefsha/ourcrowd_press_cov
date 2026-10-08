import { Module } from '@nestjs/common';

import { COLLECTOR_HEARTBEAT_STORE } from './collector-heartbeat';
import { CollectorHealthController } from './collector-health.controller';
import { CollectorHealthService } from './collector-health.service';
import { PostgresCollectorHeartbeatStore } from './repositories/postgres-collector-heartbeat.store';
import { PostgresRunHistory } from './repositories/postgres-run.history';
import { PostgresRunQueue } from './repositories/postgres-run.queue';
import { RUN_HISTORY } from './run-history';
import { RUN_QUEUE } from './run-queue';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

/**
 * The `RunQueue` binding (Postgres, ADR-009) and the runs API. Shared by both
 * roots: the API enqueues, the collector claims — the worker loop, cron and
 * heartbeat live in `worker/`.
 */
@Module({
  controllers: [RunsController, CollectorHealthController],
  providers: [
    RunsService,
    CollectorHealthService,
    { provide: RUN_QUEUE, useClass: PostgresRunQueue },
    { provide: RUN_HISTORY, useClass: PostgresRunHistory },
    { provide: COLLECTOR_HEARTBEAT_STORE, useClass: PostgresCollectorHeartbeatStore },
  ],
  exports: [RUN_QUEUE, COLLECTOR_HEARTBEAT_STORE],
})
export class RunsModule {}
