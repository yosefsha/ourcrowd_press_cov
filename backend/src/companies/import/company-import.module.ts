import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClassificationModule } from '../../classification/classification.module';
import { CollectorHeartbeatEntity } from '../../database/entities/collector-heartbeat.entity';
import { CompaniesModule } from '../companies.module';
import { HeartbeatSeedImportProgress } from './repositories/heartbeat-seed-import.progress';
import { FileSeedListSource } from './repositories/file-seed-list.source';
import { SEED_IMPORT_PROGRESS } from './seed-import-progress';
import { SeedImportService } from './seed-import.service';
import { SEED_LIST_SOURCE } from './seed-list-source';

/**
 * Seed List import and ambiguity triage (ADR-010). Collector only: the API
 * must never reach this folder (`npm run lint:boundaries`). The triage model
 * comes from `ClassificationModule` (`AMBIGUITY_TRIAGE`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([CollectorHeartbeatEntity]), CompaniesModule, ClassificationModule],
  providers: [
    SeedImportService,
    { provide: SEED_LIST_SOURCE, useClass: FileSeedListSource },
    { provide: SEED_IMPORT_PROGRESS, useClass: HeartbeatSeedImportProgress },
  ],
})
export class CompanyImportModule {}
