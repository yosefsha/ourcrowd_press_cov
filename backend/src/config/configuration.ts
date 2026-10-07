import { validateEnvironment } from './validation';

export interface DatabaseConfig {
  readonly url: string;
}

export interface AppConfig {
  readonly port: number;
  readonly database: DatabaseConfig;
}

/**
 * Typed configuration factory — the only place in the codebase that reads
 * `process.env`. Loaded into `ConfigModule` by both entry points and called
 * directly by the TypeORM CLI datasource.
 */
export function configuration(): AppConfig {
  const env = validateEnvironment(process.env);
  return {
    port: env.PORT,
    database: { url: env.DATABASE_URL },
  };
}
