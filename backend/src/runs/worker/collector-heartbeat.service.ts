import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CLASSIFIER_HEALTH, type ClassifierHealth } from '../../classification/classifier-health';
import type { AppConfig } from '../../config/configuration';
import { COLLECTOR_HEARTBEAT_STORE, type CollectorHeartbeat, type CollectorHeartbeatStore } from '../collector-heartbeat';
import { CollectorActivity } from './collector-activity';

type ModelHealth = Pick<CollectorHeartbeat, 'ollamaOk' | 'ollamaModel' | 'detail'>;

/**
 * Writes the collector heartbeat every `RUN_POLL_INTERVAL_MS` — independent of
 * the Run loop, so a long Run keeps the collector shown as online — with the
 * collector's state and the classification model's health.
 */
@Injectable()
export class CollectorHeartbeatService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CollectorHeartbeatService.name);
  private readonly pollIntervalMs: number;
  private readonly configuredModel: string;
  private timer: NodeJS.Timeout | undefined;
  private beating = false;

  constructor(
    @Inject(COLLECTOR_HEARTBEAT_STORE) private readonly store: CollectorHeartbeatStore,
    @Inject(CLASSIFIER_HEALTH) private readonly classifierHealth: ClassifierHealth,
    private readonly activity: CollectorActivity,
    config: ConfigService<AppConfig, true>,
  ) {
    this.pollIntervalMs = config.get('runs.pollIntervalMs', { infer: true });
    this.configuredModel = config.get('ollama.model', { infer: true });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.beat();
    this.timer = setInterval(() => void this.beat(), this.pollIntervalMs);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Records one heartbeat; skipped while the previous one is still being written. */
  async beat(now: () => Date = () => new Date()): Promise<void> {
    if (this.beating) return;
    this.beating = true;
    try {
      const model = await this.checkModel();
      await this.store.record({ lastSeenAt: now(), state: this.activity.state, ...model });
    } catch (error) {
      this.logger.error(`Heartbeat failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.beating = false;
    }
  }

  private async checkModel(): Promise<ModelHealth> {
    try {
      const status = await this.classifierHealth.check();
      return status.ok
        ? { ollamaOk: true, ollamaModel: status.model, detail: null }
        : { ollamaOk: false, ollamaModel: status.model, detail: status.detail };
    } catch (error) {
      return {
        ollamaOk: false,
        ollamaModel: this.configuredModel,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
