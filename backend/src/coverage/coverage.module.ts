import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { CoverageController } from './coverage.controller';
import { COVERAGE_READ_MODEL } from './coverage-read-model';
import { COVERAGE_CLOCK, COVERAGE_SETTINGS, systemClock, type CoverageSettings } from './coverage-settings';
import { CoverageService } from './coverage.service';
import { PostgresCoverageReadModel } from './repositories/postgres-coverage-read-model';

/**
 * The dashboard's read model: summary, overview, company detail and
 * Candidates for a Coverage Window. API only.
 */
@Module({
  controllers: [CoverageController],
  providers: [
    CoverageService,
    { provide: COVERAGE_READ_MODEL, useClass: PostgresCoverageReadModel },
    { provide: COVERAGE_CLOCK, useValue: systemClock },
    {
      provide: COVERAGE_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): CoverageSettings => ({
        timeZone: config.get('schedule.timeZone', { infer: true }),
      }),
    },
  ],
})
export class CoverageModule {}
