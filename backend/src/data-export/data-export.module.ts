import { Module } from '@nestjs/common';

/**
 * The `DataExporter` binding: writes the `data/` export after every Run
 * (ADR-005). Collector only.
 */
@Module({})
export class DataExportModule {}
