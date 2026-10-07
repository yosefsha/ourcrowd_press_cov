import { buildTypeOrmOptions } from './typeorm-options';

describe('buildTypeOrmOptions', () => {
  const options = buildTypeOrmOptions('postgresql://app:app@localhost:5432/app');

  it('targets Postgres at the given URL', () => {
    expect(options).toMatchObject({
      type: 'postgres',
      url: 'postgresql://app:app@localhost:5432/app',
    });
  });

  it('leaves the schema to migrations', () => {
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });

  it('loads migrations from the migrations folder beside it', () => {
    expect(options.migrations).toEqual([expect.stringMatching(/database[/\\]migrations[/\\]\*\.\{ts,js\}$/)]);
  });
});
