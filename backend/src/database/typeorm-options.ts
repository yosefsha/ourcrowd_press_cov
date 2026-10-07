import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * TypeORM options shared by the Nest application (both entry points) and the
 * TypeORM CLI datasource, so the app and `migration:run` can never disagree on
 * where entities and migrations live. Globs resolve relative to this file, so
 * they work from `src/` under ts-jest and from `dist/` in the runtime image.
 *
 * The schema is owned by migrations only — `synchronize` is never enabled.
 */
export function buildTypeOrmOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
  };
}
