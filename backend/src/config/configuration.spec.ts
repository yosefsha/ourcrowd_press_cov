import { resolve } from 'node:path';

import { configuration } from './configuration';
import { InvalidEnvironmentError } from './validation';

describe('configuration', () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  it('maps the defaults onto the typed config', () => {
    process.env = {};

    expect(configuration()).toEqual({
      port: 8000,
      database: { url: 'postgresql://app:app@localhost:5432/app' },
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'qwen2.5:7b',
        numParallel: 2,
        failureThreshold: 5,
      },
      news: {
        editions: [
          { code: 'en-US', language: 'en', country: 'US' },
          { code: 'he-IL', language: 'he', country: 'IL' },
        ],
        maxCandidatesPerCompany: null,
      },
      schedule: { dailyCheckEnabled: true, dailyCheckCron: '0 7 * * *', timeZone: 'Asia/Jerusalem' },
      alerts: { newMentionMaxAgeDays: 7 },
      runs: { pollIntervalMs: 3000 },
      dataExport: { dir: resolve('../data') },
      seedList: { path: resolve('../docs/ourcrowd_companies.txt') },
    });
  });

  it('maps every variable that is set', () => {
    process.env = {
      PORT: '8100',
      DATABASE_URL: 'postgresql://u:p@db:5432/press',
      OLLAMA_BASE_URL: 'http://host.docker.internal:11434',
      OLLAMA_MODEL: 'llama3.1:8b',
      OLLAMA_NUM_PARALLEL: '4',
      OLLAMA_FAILURE_THRESHOLD: '10',
      NEWS_EDITIONS: 'en-GB',
      MAX_CANDIDATES_PER_COMPANY: '100',
      DAILY_CHECK_SCHEDULE_ENABLED: 'false',
      DAILY_CHECK_CRON: ' 30 6 * * 1-5 ',
      TZ: 'UTC',
      NEW_MENTION_MAX_AGE_DAYS: '3',
      RUN_POLL_INTERVAL_MS: '1000',
      DATA_EXPORT_DIR: '/srv/data',
      SEED_LIST_PATH: '/srv/seed.txt',
    };

    expect(configuration()).toEqual({
      port: 8100,
      database: { url: 'postgresql://u:p@db:5432/press' },
      ollama: {
        baseUrl: 'http://host.docker.internal:11434',
        model: 'llama3.1:8b',
        numParallel: 4,
        failureThreshold: 10,
      },
      news: { editions: [{ code: 'en-GB', language: 'en', country: 'GB' }], maxCandidatesPerCompany: 100 },
      schedule: { dailyCheckEnabled: false, dailyCheckCron: '30 6 * * 1-5', timeZone: 'UTC' },
      alerts: { newMentionMaxAgeDays: 3 },
      runs: { pollIntervalMs: 1000 },
      dataExport: { dir: '/srv/data' },
      seedList: { path: '/srv/seed.txt' },
    });
  });

  it('refuses to produce a config from an invalid environment', () => {
    process.env = { PORT: 'eighty' };

    expect(() => configuration()).toThrow(InvalidEnvironmentError);
  });
});
