import type { INestApplicationContext } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { CollectorLifecycle } from '../src/collector/collector-lifecycle.service';
import { CollectorModule } from '../src/collector.module';

describe('CollectorModule application context (against Postgres)', () => {
  let context: INestApplicationContext;

  beforeAll(async () => {
    context = await NestFactory.createApplicationContext(CollectorModule, { logger: false });
  });

  afterAll(async () => {
    await context.close();
  });

  it('boots with a live database connection and is running', async () => {
    const dataSource = context.get(DataSource);

    expect(dataSource.isInitialized).toBe(true);
    await expect(dataSource.query('SELECT 1 AS ok')).resolves.toEqual([{ ok: 1 }]);
    expect(context.get(CollectorLifecycle).isRunning).toBe(true);
  });

  it('has no HTTP server', () => {
    expect(context.get(HttpAdapterHost, { strict: false }).httpAdapter).toBeFalsy();
  });

  it('releases its keep-alive handle and the database on close', async () => {
    const separate = await NestFactory.createApplicationContext(CollectorModule, { logger: false });
    const lifecycle = separate.get(CollectorLifecycle);
    const dataSource = separate.get(DataSource);

    await separate.close();

    expect(lifecycle.isRunning).toBe(false);
    expect(dataSource.isInitialized).toBe(false);
  });
});
