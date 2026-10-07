import type { AlertDigest } from '../../domain/alert-digest';
import { AlertDeliveryFailed, type AlertNotifier } from '../alert-notifier';

/** In-memory `AlertNotifier` for tests: records every digest, or fails when told to. */
export class InMemoryAlertNotifier implements AlertNotifier {
  private readonly received: AlertDigest[] = [];

  constructor(private readonly failWith: string | null = null) {}

  get delivered(): readonly AlertDigest[] {
    return this.received;
  }

  notify(digest: AlertDigest): Promise<void> {
    if (this.failWith !== null) return Promise.reject(new AlertDeliveryFailed('in-memory', this.failWith));
    this.received.push(digest);
    return Promise.resolve();
  }
}
