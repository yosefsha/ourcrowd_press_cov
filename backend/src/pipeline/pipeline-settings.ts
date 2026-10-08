import type { AppConfig } from '../config/configuration';
import type { NewsEdition } from '../domain/news-edition';

/** Injection token for the `PipelineSettings` value. */
export const PIPELINE_SETTINGS = Symbol('PIPELINE_SETTINGS');

/** The configuration the Backfill and the Daily Check run with. */
export interface PipelineSettings {
  readonly editions: readonly [NewsEdition, ...NewsEdition[]];
  /** Null means no cap. */
  readonly maxCandidatesPerCompany: number | null;
  /** Consecutive `ClassifierUnavailable` failures after which the Run stops as failed. */
  readonly classifierFailureThreshold: number;
  /** A company's Candidates classified at once; matches the Ollama client's `numParallel`. */
  readonly classificationConcurrency: number;
  /** IANA zone of the Coverage Window and of `until` dates. */
  readonly timeZone: string;
}

/** Picks the pipeline's settings out of the application configuration. */
export function pipelineSettingsFrom(config: Pick<AppConfig, 'news' | 'ollama' | 'schedule'>): PipelineSettings {
  return {
    editions: config.news.editions,
    maxCandidatesPerCompany: config.news.maxCandidatesPerCompany,
    classifierFailureThreshold: config.ollama.failureThreshold,
    classificationConcurrency: config.ollama.numParallel,
    timeZone: config.schedule.timeZone,
  };
}
