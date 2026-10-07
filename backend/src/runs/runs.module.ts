import { Module } from '@nestjs/common';

/**
 * The `RunQueue` binding (Postgres, ADR-009) and the runs API. Shared by both
 * roots: the API enqueues, the collector claims — the worker loop, cron and
 * heartbeat live in `worker/`.
 */
@Module({})
export class RunsModule {}
