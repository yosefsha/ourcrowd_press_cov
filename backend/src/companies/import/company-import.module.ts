import { Module } from '@nestjs/common';

/**
 * Seed List import and ambiguity triage (ADR-010). Collector only: the API
 * must never reach this folder (`npm run lint:boundaries`).
 */
@Module({})
export class CompanyImportModule {}
