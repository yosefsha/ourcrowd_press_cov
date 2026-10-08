/** Injection token for the `SeedImportProgress` port. */
export const SEED_IMPORT_PROGRESS = Symbol('SEED_IMPORT_PROGRESS');

/** How far the Seed List import has got, for the collector heartbeat. */
export interface SeedImportProgressSnapshot {
  readonly imported: number;
  readonly total: number;
}

/** Publishes the Seed List import's state where the dashboard can see it (the collector heartbeat). */
export interface SeedImportProgress {
  /** The collector is importing; called before the first company and after each one. */
  importing(progress: SeedImportProgressSnapshot): Promise<void>;
  /** The import has stopped — finished, or halted with `detail` explaining why. */
  stopped(detail: string | null): Promise<void>;
}
