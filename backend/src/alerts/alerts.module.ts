import { Module } from '@nestjs/common';

import { ALERT_DIGEST_REPOSITORY } from './alert-digest.repository';
import { AlertsController } from './alerts.controller';
import { ALERTS_CLOCK, AlertsService, type Clock } from './alerts.service';
import { PostgresAlertDigestRepository } from './repositories/postgres-alert-digest.repository';

/**
 * Alert Digests as the dashboard reads and acknowledges them (ADR-004). API
 * side; building and delivering digests is collector-only, in `notifiers/`.
 */
@Module({
  controllers: [AlertsController],
  providers: [
    AlertsService,
    { provide: ALERT_DIGEST_REPOSITORY, useClass: PostgresAlertDigestRepository },
    { provide: ALERTS_CLOCK, useValue: ((): Date => new Date()) satisfies Clock },
  ],
})
export class AlertsModule {}
