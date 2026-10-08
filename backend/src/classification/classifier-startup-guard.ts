import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ClassifierUnavailable } from './classifier-errors';
import { CLASSIFIER_HEALTH, type ClassifierHealth } from './classifier-health';

/**
 * Makes the collector refuse to boot when the classification model is not
 * usable (ADR-007): Nest awaits `onModuleInit` before any module starts work,
 * so a failed check aborts startup with an actionable message instead of
 * failing every classification of the first Run. The API never imports this
 * module, so it never depends on Ollama (ADR-009).
 */
@Injectable()
export class ClassifierStartupGuard implements OnModuleInit {
  private readonly logger = new Logger(ClassifierStartupGuard.name);

  constructor(@Inject(CLASSIFIER_HEALTH) private readonly health: ClassifierHealth) {}

  async onModuleInit(): Promise<void> {
    const status = await this.health.check();
    if (!status.ok) {
      const message = `The collector cannot start: ${status.detail}`;
      this.logger.error(message);
      throw new ClassifierUnavailable(message);
    }
    this.logger.log(`Classification model ${status.model} is ready`);
  }
}
