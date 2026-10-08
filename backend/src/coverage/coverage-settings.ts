/** Injection token for the clock the read model measures Mention Status and Coverage Windows against. */
export const COVERAGE_CLOCK = Symbol('COVERAGE_CLOCK');

/** Tells the current time; injected so tests can fix "now". */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Injection token for `CoverageSettings`. */
export const COVERAGE_SETTINGS = Symbol('COVERAGE_SETTINGS');

export interface CoverageSettings {
  /** IANA zone for quarter boundaries, Mention Status day counts and week starts. */
  readonly timeZone: string;
}
