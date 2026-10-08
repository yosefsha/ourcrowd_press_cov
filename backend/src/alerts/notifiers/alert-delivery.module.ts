import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { ALERT_DIGEST_BUILDER, type AlertDigestBuilder } from '../alert-digest-builder';
import { ALERT_NOTIFIERS, type AlertNotifier } from '../alert-notifier';
import { ALERT_DIGEST_STORE, type AlertDigestStore } from './alert-digest.store';
import { FileAlertNotifier } from './file-alert-notifier';
import { LogAlertNotifier } from './log-alert-notifier';
import { NewMentionAlertDigestBuilder } from './new-mention-alert-digest.builder';
import { PostgresAlertDigestStore } from './postgres-alert-digest.store';

/**
 * The `AlertDigestBuilder` and `AlertNotifier` bindings: builds the digest of
 * a Daily Check and delivers it to every channel (ADR-004). Collector only: the
 * API must never reach this folder (`npm run lint:boundaries`).
 *
 * The stored digest row is the dashboard channel; `ALERT_NOTIFIERS` lists the
 * others. Adding a channel means adding a notifier to that list.
 */
@Module({
  providers: [
    { provide: ALERT_DIGEST_STORE, useClass: PostgresAlertDigestStore },
    {
      provide: ALERT_NOTIFIERS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): readonly AlertNotifier[] => [
        new LogAlertNotifier(new Logger('AlertDigest')),
        new FileAlertNotifier({
          dataExportDir: config.get('dataExport.dir', { infer: true }),
          timeZone: config.get('schedule.timeZone', { infer: true }),
        }),
      ],
    },
    {
      provide: ALERT_DIGEST_BUILDER,
      inject: [ALERT_DIGEST_STORE, ALERT_NOTIFIERS, ConfigService],
      useFactory: (
        store: AlertDigestStore,
        notifiers: readonly AlertNotifier[],
        config: ConfigService<AppConfig, true>,
      ): AlertDigestBuilder =>
        new NewMentionAlertDigestBuilder(
          store,
          notifiers,
          { maxAgeDays: config.get('alerts.newMentionMaxAgeDays', { infer: true }) },
          () => new Date(),
        ),
    },
  ],
  exports: [ALERT_DIGEST_BUILDER],
})
export class AlertDeliveryModule {}
