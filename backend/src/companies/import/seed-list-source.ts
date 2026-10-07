import type { SeedCompany } from '../../domain/seed-line';

/** Injection token for the `SeedListSource` port. */
export const SEED_LIST_SOURCE = Symbol('SEED_LIST_SOURCE');

/** Where the Seed List comes from: its companies, parsed, in file order. */
export interface SeedListSource {
  /** Throws `SeedListUnavailable`, or `UnparseableSeedLine` for a malformed line. */
  read(): Promise<readonly SeedCompany[]>;
}

/** The Seed List could not be read at all. */
export class SeedListUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SeedListUnavailable';
  }
}
