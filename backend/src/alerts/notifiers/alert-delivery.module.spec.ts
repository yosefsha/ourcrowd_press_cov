import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppConfigModule } from '../../config/app-config.module';
import { ALERT_DIGEST_BUILDER, type AlertDigestBuilder } from '../alert-digest-builder';
import { ALERT_NOTIFIERS, type AlertNotifier } from '../alert-notifier';
import { AlertDeliveryModule } from './alert-delivery.module';
import { ALERT_DIGEST_STORE } from './alert-digest.store';
import { FileAlertNotifier } from './file-alert-notifier';
import { InMemoryAlertDigestStore } from './in-memory-alert-digest.store';
import { LogAlertNotifier } from './log-alert-notifier';
import { NewMentionAlertDigestBuilder } from './new-mention-alert-digest.builder';

/** Stands in for the Daily Check executor (#9), which imports the module and injects the builder. */
@Injectable()
class DailyCheckStandIn {
  constructor(@Inject(ALERT_DIGEST_BUILDER) readonly builder: AlertDigestBuilder) {}
}

@Module({ imports: [AlertDeliveryModule], providers: [DailyCheckStandIn] })
class ConsumerModule {}

describe('AlertDeliveryModule', () => {
  it('exports ALERT_DIGEST_BUILDER to a module that imports it, and binds the log and file notifiers', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppConfigModule, ConsumerModule] })
      .overrideProvider(ALERT_DIGEST_STORE)
      .useValue(new InMemoryAlertDigestStore([]))
      .compile();

    expect(moduleRef.get(DailyCheckStandIn).builder).toBeInstanceOf(NewMentionAlertDigestBuilder);
    const notifiers = moduleRef.get<readonly AlertNotifier[]>(ALERT_NOTIFIERS, { strict: false });
    expect(notifiers.map((notifier) => notifier.constructor)).toEqual([LogAlertNotifier, FileAlertNotifier]);
  });
});
