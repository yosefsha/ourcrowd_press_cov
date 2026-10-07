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
});
