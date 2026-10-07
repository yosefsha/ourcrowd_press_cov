import type { AlertDigest } from '../domain/alert-digest';

/**
 * Injection token for the list of `AlertNotifier`s. Every channel receives each
 * digest; adding a channel means adding a notifier to the list.
 */
export const ALERT_NOTIFIERS = Symbol('ALERT_NOTIFIERS');

/** Delivers an Alert Digest through one channel (log, file, …). The dashboard reads the stored digest. */
export interface AlertNotifier {
  /** Throws `AlertDeliveryFailed`. */
  notify(digest: AlertDigest): Promise<void>;
}

export class AlertDeliveryFailed extends Error {
  constructor(
    readonly channel: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`Alert delivery via ${channel} failed: ${message}`, options);
    this.name = 'AlertDeliveryFailed';
  }
}
