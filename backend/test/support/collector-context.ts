import type { INestApplicationContext } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { CLASSIFIER_HEALTH, type ClassifierHealth } from '../../src/classification/classifier-health';
import { CollectorModule } from '../../src/collector.module';

/**
 * Stands in for Ollama's startup probe: CI has no Ollama (ADR-006), and the
 * collector refuses to boot without it (ADR-007). Specs that classify must
 * also override the classifier tokens with the recorded in-memory classifiers.
 */
export const READY_CLASSIFIER_HEALTH: ClassifierHealth = {
  check: () => Promise.resolve({ ok: true, model: 'qwen2.5:7b' }),
};

/**
 * Boots the collector's root module as `worker.ts` does, against the real
 * Postgres, with `CLASSIFIER_HEALTH` overridden. `configure` adds further
 * overrides (e.g. `.overrideProvider(RELEVANCE_CLASSIFIER).useValue(...)`).
 */
export async function createCollectorContext(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplicationContext> {
  const builder = Test.createTestingModule({ imports: [CollectorModule] })
    .overrideProvider(CLASSIFIER_HEALTH)
    .useValue(READY_CLASSIFIER_HEALTH)
    .setLogger({ log: () => undefined, error: () => undefined, warn: () => undefined });
  const moduleRef = await configure(builder).compile();
  return moduleRef.init();
}
