import { Module } from '@nestjs/common';

/**
 * The `AlertDigestBuilder` and `AlertNotifier` bindings: builds the digest of
 * a Daily Check and delivers it to every channel (ADR-004). Collector only: the
 * API must never reach this folder (`npm run lint:boundaries`).
 */
@Module({})
export class AlertDeliveryModule {}
