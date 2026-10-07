import {
  DEFAULT_DATABASE_URL,
  DEFAULT_PORT,
  InvalidEnvironmentError,
  validateEnvironment,
} from './validation';

describe('validateEnvironment', () => {
  it('applies the local-development defaults when nothing is set', () => {
    const env = validateEnvironment({});

    expect(env.PORT).toBe(DEFAULT_PORT);
    expect(env.DATABASE_URL).toBe(DEFAULT_DATABASE_URL);
  });

  it('treats empty strings as unset', () => {
    const env = validateEnvironment({ PORT: '', DATABASE_URL: '' });

    expect(env.PORT).toBe(8000);
    expect(env.DATABASE_URL).toBe('postgresql://app:app@localhost:5432/app');
  });

  it('converts PORT to a number and accepts a compose-style database host', () => {
    const env = validateEnvironment({
      PORT: '9001',
      DATABASE_URL: 'postgres://app:secret@postgres:5432/app',
    });

    expect(env.PORT).toBe(9001);
    expect(env.DATABASE_URL).toBe('postgres://app:secret@postgres:5432/app');
  });

  it('ignores variables it does not own', () => {
    expect(() => validateEnvironment({ HOME: '/root', NODE_ENV: 'test' })).not.toThrow();
  });

  it.each([['not-a-number'], ['0'], ['70000'], ['80.5']])('rejects PORT=%s', (port) => {
    expect(() => validateEnvironment({ PORT: port })).toThrow(InvalidEnvironmentError);
  });

  it.each([['mysql://app:app@localhost/app'], ['not a url'], ['localhost:5432/app']])(
    'rejects DATABASE_URL=%s',
    (url) => {
      expect(() => validateEnvironment({ DATABASE_URL: url })).toThrow(InvalidEnvironmentError);
    },
  );

  it('reports every problem in one error', () => {
    let caught: unknown;
    try {
      validateEnvironment({ PORT: 'x', DATABASE_URL: 'y' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvalidEnvironmentError);
    const problems = (caught as InvalidEnvironmentError).problems.join(' ');
    expect(problems).toContain('PORT');
    expect(problems).toContain('DATABASE_URL');
  });

  describe('pipeline settings', () => {
    it('defaults to the production values from the implementation plan', () => {
      const env = validateEnvironment({});

      expect(env).toMatchObject({
        OLLAMA_BASE_URL: 'http://localhost:11434',
        OLLAMA_MODEL: 'qwen2.5:7b',
        OLLAMA_NUM_PARALLEL: 2,
        OLLAMA_FAILURE_THRESHOLD: 5,
        NEWS_EDITIONS: 'en-US,he-IL',
        DAILY_CHECK_SCHEDULE_ENABLED: true,
        DAILY_CHECK_CRON: '0 7 * * *',
        TZ: 'Asia/Jerusalem',
        NEW_MENTION_MAX_AGE_DAYS: 7,
        RUN_POLL_INTERVAL_MS: 3000,
        DATA_EXPORT_DIR: '../data',
        SEED_LIST_PATH: '../docs/ourcrowd_companies.txt',
      });
      expect(env.MAX_CANDIDATES_PER_COMPANY).toBeUndefined();
    });

    it.each([
      ['true', true],
      ['TRUE', true],
      ['1', true],
      ['false', false],
      ['False', false],
      ['0', false],
    ])('reads DAILY_CHECK_SCHEDULE_ENABLED=%s as %s', (raw, expected) => {
      expect(validateEnvironment({ DAILY_CHECK_SCHEDULE_ENABLED: raw }).DAILY_CHECK_SCHEDULE_ENABLED).toBe(
        expected,
      );
    });

    it('accepts a cap on Candidates per company', () => {
      expect(validateEnvironment({ MAX_CANDIDATES_PER_COMPANY: '50' }).MAX_CANDIDATES_PER_COMPANY).toBe(50);
    });

    it.each([
      ['OLLAMA_BASE_URL', 'ftp://ollama:11434'],
      ['OLLAMA_BASE_URL', 'localhost:11434'],
      ['OLLAMA_MODEL', 'qwen 2.5'],
      ['OLLAMA_NUM_PARALLEL', '0'],
      ['OLLAMA_NUM_PARALLEL', 'two'],
      ['OLLAMA_FAILURE_THRESHOLD', '0'],
      ['NEWS_EDITIONS', 'english'],
      ['NEWS_EDITIONS', 'en-US,en-US'],
      ['NEWS_EDITIONS', ','],
      ['DAILY_CHECK_SCHEDULE_ENABLED', 'yes'],
      ['DAILY_CHECK_CRON', '0 7 * *'],
      ['DAILY_CHECK_CRON', '0 25 * * *'],
      ['TZ', 'Jerusalem'],
      ['NEW_MENTION_MAX_AGE_DAYS', '0'],
      ['NEW_MENTION_MAX_AGE_DAYS', '1.5'],
      ['RUN_POLL_INTERVAL_MS', '10'],
      ['MAX_CANDIDATES_PER_COMPANY', '0'],
      ['MAX_CANDIDATES_PER_COMPANY', 'unlimited'],
    ])('rejects %s=%s', (key, value) => {
      expect(() => validateEnvironment({ [key]: value })).toThrow(InvalidEnvironmentError);
      expect(() => validateEnvironment({ [key]: value })).toThrow(key);
    });
  });
});
