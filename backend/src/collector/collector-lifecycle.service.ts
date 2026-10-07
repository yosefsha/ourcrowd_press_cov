import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

/** Longest delay `setInterval` accepts (2^31 - 1 ms). */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Keeps the collector process alive between bootstrap and shutdown. A Nest
 * application context opens no listener, so without an active handle Node
 * would exit as soon as bootstrap finished. The handle is released on
 * shutdown (SIGTERM via `enableShutdownHooks`), letting the process drain.
 */
@Injectable()
export class CollectorLifecycle implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CollectorLifecycle.name);
  private keepAlive: NodeJS.Timeout | undefined;

  onApplicationBootstrap(): void {
    this.keepAlive = setInterval(() => undefined, MAX_TIMER_DELAY_MS);
    this.logger.log('Collector started');
  }

  onApplicationShutdown(signal?: string): void {
    clearInterval(this.keepAlive);
    this.keepAlive = undefined;
    this.logger.log(`Collector stopped${signal ? ` (${signal})` : ''}`);
  }

  get isRunning(): boolean {
    return this.keepAlive !== undefined;
  }
}
