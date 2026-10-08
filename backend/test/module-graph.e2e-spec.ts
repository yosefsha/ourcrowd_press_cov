import type { INestApplicationContext, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AlertDeliveryModule } from '../src/alerts/notifiers/alert-delivery.module';
import { AlertsModule } from '../src/alerts/alerts.module';
import { ApiModule } from '../src/api.module';
import { ClassificationModule } from '../src/classification/classification.module';
import { CompaniesModule } from '../src/companies/companies.module';
import { CompanyImportModule } from '../src/companies/import/company-import.module';
import { configureApiApp } from '../src/configure-api-app';
import { CoverageModule } from '../src/coverage/coverage.module';
import { DataExportModule } from '../src/data-export/data-export.module';
import { NewsModule } from '../src/news/news.module';
import { PipelineModule } from '../src/pipeline/pipeline.module';
import { RunsModule } from '../src/runs/runs.module';
import { RunWorkerModule } from '../src/runs/worker/run-worker.module';
import { createCollectorContext } from './support/collector-context';

const COLLECTOR_ONLY: readonly Type[] = [
  CompanyImportModule,
  NewsModule,
  ClassificationModule,
  RunWorkerModule,
  PipelineModule,
  AlertDeliveryModule,
  DataExportModule,
];

function isLoaded(context: INestApplicationContext, module: Type): boolean {
  try {
    context.get(module, { strict: false });
    return true;
  } catch {
    return false;
  }
}

/** Each feature module is registered in the right root (ADR-009), checked at runtime. */
describe('feature modules in both roots (against Postgres)', () => {
  describe('ApiModule', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [ApiModule] }).compile();
      app = configureApiApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it.each([CompaniesModule, RunsModule, CoverageModule, AlertsModule].map((module) => [module.name, module]))(
      'loads %s',
      (_name, module) => {
        expect(isLoaded(app, module)).toBe(true);
      },
    );

    it.each(COLLECTOR_ONLY.map((module) => [module.name, module]))('does not load %s', (_name, module) => {
      expect(isLoaded(app, module)).toBe(false);
    });
  });

  describe('CollectorModule', () => {
    let context: INestApplicationContext;

    beforeAll(async () => {
      context = await createCollectorContext();
    });

    afterAll(async () => {
      await context.close();
    });

    it.each([CompaniesModule, RunsModule, ...COLLECTOR_ONLY].map((module) => [module.name, module]))(
      'loads %s',
      (_name, module) => {
        expect(isLoaded(context, module)).toBe(true);
      },
    );

    it.each([CoverageModule, AlertsModule].map((module) => [module.name, module]))('does not load %s', (_name, module) => {
      expect(isLoaded(context, module)).toBe(false);
    });
  });
});
