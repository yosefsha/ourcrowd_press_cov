import { Module } from '@nestjs/common';

/**
 * Alert Digests as the dashboard reads and acknowledges them (ADR-004). API
 * side; building and delivering digests is collector-only, in `notifiers/`.
 */
@Module({})
export class AlertsModule {}
