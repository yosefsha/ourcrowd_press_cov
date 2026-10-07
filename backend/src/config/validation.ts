import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { IsInt, IsUrl, Max, Min, validateSync } from 'class-validator';

export const DEFAULT_PORT = 8000;
export const DEFAULT_DATABASE_URL = 'postgresql://app:app@localhost:5432/app';

/**
 * The environment the backend accepts. Every variable the application reads is
 * declared here, so a bad value fails the boot instead of surfacing as an
 * `undefined` at the first request. Unset variables take the local-development
 * defaults below.
 */
export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  readonly PORT: number = DEFAULT_PORT;

  @IsUrl({
    protocols: ['postgres', 'postgresql'],
    require_protocol: true,
    require_tld: false,
  })
  readonly DATABASE_URL: string = DEFAULT_DATABASE_URL;
}

export class InvalidEnvironmentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid environment: ${problems.join('; ')}`);
    this.name = 'InvalidEnvironmentError';
  }
}

/**
 * Validates raw environment variables and returns them typed, with defaults
 * applied. Throws `InvalidEnvironmentError` listing every problem at once.
 */
export function validateEnvironment(raw: Record<string, unknown>): EnvironmentVariables {
  const defined = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined && value !== ''),
  );
  const env = plainToInstance(EnvironmentVariables, defined, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new InvalidEnvironmentError(
      errors.flatMap((error) => Object.values(error.constraints ?? {})),
    );
  }
  return env;
}
