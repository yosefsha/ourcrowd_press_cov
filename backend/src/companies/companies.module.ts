import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TrackedCompanyEntity } from '../database/entities/tracked-company.entity';
import { RunsModule } from '../runs/runs.module';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompaniesService } from './companies.service';
import { PostgresTrackedCompanyRepository } from './repositories/postgres-tracked-company.repository';
import { TRACKED_COMPANY_REPOSITORY } from './tracked-company.repository';

/**
 * Tracked Companies and their Company Profiles: the `TrackedCompanyRepository`
 * binding, the service and the admin controller. Shared by both roots — the
 * collector-only Seed List import lives in `import/`. Re-process queues its
 * Backfill through the `RunQueue` that `RunsModule` exports.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TrackedCompanyEntity]), RunsModule],
  controllers: [AdminCompaniesController],
  providers: [
    CompaniesService,
    { provide: TRACKED_COMPANY_REPOSITORY, useClass: PostgresTrackedCompanyRepository },
  ],
  exports: [TRACKED_COMPANY_REPOSITORY],
})
export class CompaniesModule {}
