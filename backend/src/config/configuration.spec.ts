import { configuration } from './configuration';
import { InvalidEnvironmentError } from './validation';

describe('configuration', () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  it('maps the validated environment onto the typed config', () => {
    process.env = { PORT: '8100', DATABASE_URL: 'postgresql://u:p@db:5432/press' };

    expect(configuration()).toEqual({
      port: 8100,
      database: { url: 'postgresql://u:p@db:5432/press' },
    });
  });

  it('refuses to produce a config from an invalid environment', () => {
    process.env = { PORT: 'eighty' };

    expect(() => configuration()).toThrow(InvalidEnvironmentError);
  });
});
