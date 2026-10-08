import type { INestApplicationContext } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { AMBIGUITY_TRIAGE, type AmbiguityAssessment, type AmbiguityTriage } from '../../src/classification/ambiguity-triage';
import { CLASSIFIER_HEALTH, type ClassifierHealth } from '../../src/classification/classifier-health';
import { ClassifierUnavailable } from '../../src/classification/classifier-errors';
import { SEED_LIST_SOURCE, type SeedListSource } from '../../src/companies/import/seed-list-source';
import { CollectorModule } from '../../src/collector.module';
import type { SeedCompany } from '../../src/domain/seed-line';

/**
 * Stands in for Ollama's startup probe: CI has no Ollama (ADR-006), and the
 * collector refuses to boot without it (ADR-007). Specs that classify must
 * also override the classifier tokens with the recorded in-memory classifiers.
 */
export const READY_CLASSIFIER_HEALTH: ClassifierHealth = {
  check: () => Promise.resolve({ ok: true, model: 'qwen2.5:7b' }),
};

/**
 * The default triage for a collector booted in a test: it never reaches
 * Ollama, and answers as an unreachable model would, so an import that does
 * call it pauses instead of triaging.
 */
export const OFFLINE_AMBIGUITY_TRIAGE: AmbiguityTriage = {
  assess: (name: string): Promise<AmbiguityAssessment> =>
    Promise.reject(new ClassifierUnavailable(`No ambiguity triage in this test (asked about "${name}")`)),
};

/** An empty Seed List: the collector's startup import has nothing to do. */
export const EMPTY_SEED_LIST: SeedListSource = {
  read: (): Promise<readonly SeedCompany[]> => Promise.resolve([]),
};

export interface CollectorContextOptions {
  /** Defaults to `OFFLINE_AMBIGUITY_TRIAGE`. */
  readonly ambiguityTriage?: AmbiguityTriage;
  /** Defaults to `EMPTY_SEED_LIST`, which makes the Seed List import a no-op. */
  readonly seedList?: SeedListSource;
}

/**
 * Boots the collector's root module as `worker.ts` does, against the real
 * Postgres, with `CLASSIFIER_HEALTH` overridden and the startup Seed List
 * import kept away from Ollama and the real Seed List (see the options).
 * `configure` adds further overrides (e.g.
 * `.overrideProvider(RELEVANCE_CLASSIFIER).useValue(...)`).
 */
export async function createCollectorContext(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
  options: CollectorContextOptions = {},
): Promise<INestApplicationContext> {
  const builder = Test.createTestingModule({ imports: [CollectorModule] })
    .overrideProvider(CLASSIFIER_HEALTH)
    .useValue(READY_CLASSIFIER_HEALTH)
    .overrideProvider(AMBIGUITY_TRIAGE)
    .useValue(options.ambiguityTriage ?? OFFLINE_AMBIGUITY_TRIAGE)
    .overrideProvider(SEED_LIST_SOURCE)
    .useValue(options.seedList ?? EMPTY_SEED_LIST)
    .setLogger({ log: () => undefined, error: () => undefined, warn: () => undefined });
  const moduleRef = await configure(builder).compile();
  return moduleRef.init();
}
