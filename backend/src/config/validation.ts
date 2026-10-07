import 'reflect-metadata';

import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  validateSync,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

import { parseNewsEditions } from '../domain/news-edition';
import { isTimeZone } from '../domain/time-zone';
import { isCronExpression } from './cron-expression';

export const DEFAULT_PORT = 8000;
export const DEFAULT_DATABASE_URL = 'postgresql://app:app@localhost:5432/app';
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';
export const DEFAULT_OLLAMA_NUM_PARALLEL = 2;
export const DEFAULT_OLLAMA_FAILURE_THRESHOLD = 5;
export const DEFAULT_NEWS_EDITIONS = 'en-US,he-IL';
export const DEFAULT_DAILY_CHECK_SCHEDULE_ENABLED = true;
export const DEFAULT_DAILY_CHECK_CRON = '0 7 * * *';
export const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';
export const DEFAULT_NEW_MENTION_MAX_AGE_DAYS = 7;
export const DEFAULT_RUN_POLL_INTERVAL_MS = 3000;
export const DEFAULT_DATA_EXPORT_DIR = '../data';
export const DEFAULT_SEED_LIST_PATH = '../docs/ourcrowd_companies.txt';

/** A property decorator validating with a plain predicate. */
function Satisfies(
  name: string,
  predicate: (value: unknown) => boolean,
  message: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    { name, validator: { validate: predicate, defaultMessage: () => message } },
    options,
  );
}

function isNewsEditionList(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    parseNewsEditions(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * `true`/`false` (also `1`/`0`, any case) from the environment. Implicit
 * conversion would turn the string `false` into `true`, so the raw value is
 * read; anything else is left as-is for `@IsBoolean` to reject.
 */
function toBooleanFlag({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return raw;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return raw;
}

/**
 * The environment the backend accepts. Every variable the application reads is
 * declared here, so a bad value fails the boot instead of surfacing as an
 * `undefined` at the first request. Unset variables take the defaults below,
 * which are the production values from the implementation plan; only
 * `DATABASE_URL` points at the local-development database by default.
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

  /** Ollama on the host (ADR-007); `http://host.docker.internal:11434` from a container. */
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  readonly OLLAMA_BASE_URL: string = DEFAULT_OLLAMA_BASE_URL;

  @IsString()
  @Matches(/^[A-Za-z0-9][\w.\-/:]*$/, { message: 'OLLAMA_MODEL must be an Ollama model name such as qwen2.5:7b' })
  readonly OLLAMA_MODEL: string = DEFAULT_OLLAMA_MODEL;

  /** Classification requests in flight at once; match Ollama's own OLLAMA_NUM_PARALLEL. */
  @IsInt()
  @Min(1)
  @Max(32)
  readonly OLLAMA_NUM_PARALLEL: number = DEFAULT_OLLAMA_NUM_PARALLEL;

  /** Consecutive Ollama failures after which a Run stops classifying and fails. */
  @IsInt()
  @Min(1)
  @Max(1000)
  readonly OLLAMA_FAILURE_THRESHOLD: number = DEFAULT_OLLAMA_FAILURE_THRESHOLD;

  @Satisfies(
    'isNewsEditionList',
    isNewsEditionList,
    'NEWS_EDITIONS must be a comma-separated list of distinct editions such as en-US,he-IL',
  )
  readonly NEWS_EDITIONS: string = DEFAULT_NEWS_EDITIONS;

  @Transform(toBooleanFlag)
  @IsBoolean({ message: 'DAILY_CHECK_SCHEDULE_ENABLED must be true or false' })
  readonly DAILY_CHECK_SCHEDULE_ENABLED: boolean = DEFAULT_DAILY_CHECK_SCHEDULE_ENABLED;

  @Satisfies(
    'isCronExpression',
    (value) => typeof value === 'string' && isCronExpression(value),
    'DAILY_CHECK_CRON must be a five-field cron expression such as "0 7 * * *"',
  )
  readonly DAILY_CHECK_CRON: string = DEFAULT_DAILY_CHECK_CRON;

  /** IANA zone for the daily cron, quarter boundaries and Mention Status day counts. */
  @Satisfies(
    'isTimeZone',
    (value) => typeof value === 'string' && isTimeZone(value),
    'TZ must be an IANA time zone such as Asia/Jerusalem',
  )
  readonly TZ: string = DEFAULT_TIME_ZONE;

  /** A Mention published longer ago than this is stored but never alerted on (ADR-004). */
  @IsInt()
  @Min(1)
  @Max(90)
  readonly NEW_MENTION_MAX_AGE_DAYS: number = DEFAULT_NEW_MENTION_MAX_AGE_DAYS;

  /** How often the collector looks for a queued Run. */
  @IsInt()
  @Min(250)
  @Max(60_000)
  readonly RUN_POLL_INTERVAL_MS: number = DEFAULT_RUN_POLL_INTERVAL_MS;

  /** Where the `data/` export is written, relative to the working directory. */
  @IsString()
  @IsNotEmpty()
  readonly DATA_EXPORT_DIR: string = DEFAULT_DATA_EXPORT_DIR;

  /** The Seed List imported once into an empty table, relative to the working directory. */
  @IsString()
  @IsNotEmpty()
  readonly SEED_LIST_PATH: string = DEFAULT_SEED_LIST_PATH;

  /** Most Candidates collected per company per Run; unset means no cap. */
  @IsOptional()
  // A union type carries no runtime type, so implicit conversion needs the hint.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly MAX_CANDIDATES_PER_COMPANY: number | undefined = undefined;
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
