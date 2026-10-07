import { resolve } from 'node:path';

import type { NewsEdition } from '../domain/news-edition';
import { parseNewsEditions } from '../domain/news-edition';
import { validateEnvironment } from './validation';

export interface DatabaseConfig {
  readonly url: string;
}

export interface OllamaConfig {
  readonly baseUrl: string;
  readonly model: string;
  readonly numParallel: number;
  /** Consecutive failures after which a Run gives up on classification. */
  readonly failureThreshold: number;
}

export interface NewsConfig {
  readonly editions: readonly [NewsEdition, ...NewsEdition[]];
  /** Null means no cap. */
  readonly maxCandidatesPerCompany: number | null;
}

export interface ScheduleConfig {
  readonly dailyCheckEnabled: boolean;
  readonly dailyCheckCron: string;
  /** IANA zone for the cron, quarter boundaries and Mention Status day counts. */
  readonly timeZone: string;
}

export interface AlertsConfig {
  readonly newMentionMaxAgeDays: number;
}

export interface RunsConfig {
  readonly pollIntervalMs: number;
}

export interface DataExportConfig {
  /** Absolute path of the `data/` export folder. */
  readonly dir: string;
}

export interface SeedListConfig {
  /** Absolute path of the Seed List file. */
  readonly path: string;
}

export interface AppConfig {
  readonly port: number;
  readonly database: DatabaseConfig;
  readonly ollama: OllamaConfig;
  readonly news: NewsConfig;
  readonly schedule: ScheduleConfig;
  readonly alerts: AlertsConfig;
  readonly runs: RunsConfig;
  readonly dataExport: DataExportConfig;
  readonly seedList: SeedListConfig;
}

/**
 * Typed configuration factory — the only place in the codebase that reads
 * `process.env`. Loaded into `ConfigModule` by both entry points and called
 * directly by the TypeORM CLI datasource. Relative paths resolve against the
 * working directory (`backend/` locally).
 */
export function configuration(): AppConfig {
  const env = validateEnvironment(process.env);
  return {
    port: env.PORT,
    database: { url: env.DATABASE_URL },
    ollama: {
      baseUrl: env.OLLAMA_BASE_URL,
      model: env.OLLAMA_MODEL,
      numParallel: env.OLLAMA_NUM_PARALLEL,
      failureThreshold: env.OLLAMA_FAILURE_THRESHOLD,
    },
    news: {
      editions: parseNewsEditions(env.NEWS_EDITIONS),
      maxCandidatesPerCompany: env.MAX_CANDIDATES_PER_COMPANY ?? null,
    },
    schedule: {
      dailyCheckEnabled: env.DAILY_CHECK_SCHEDULE_ENABLED,
      dailyCheckCron: env.DAILY_CHECK_CRON.trim(),
      timeZone: env.TZ,
    },
    alerts: { newMentionMaxAgeDays: env.NEW_MENTION_MAX_AGE_DAYS },
    runs: { pollIntervalMs: env.RUN_POLL_INTERVAL_MS },
    dataExport: { dir: resolve(env.DATA_EXPORT_DIR) },
    seedList: { path: resolve(env.SEED_LIST_PATH) },
  };
}
