import { Module } from '@nestjs/common';

/**
 * The collector's Run loop, daily-check cron and heartbeat: claims queued Runs
 * and hands each to the `RunExecutor` for its type. Collector only.
 */
@Module({})
export class RunWorkerModule {}
