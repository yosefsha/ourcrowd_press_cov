import type { Snapshot } from './export-format';

/** Injection token for the `SnapshotReader` port. */
export const SNAPSHOT_READER = Symbol('SNAPSHOT_READER');

/** Injection token for the `SnapshotLoader` port. */
export const SNAPSHOT_LOADER = Symbol('SNAPSHOT_LOADER');

/** Reads everything the export covers, as one consistent snapshot. */
export interface SnapshotReader {
  /** Throws `SnapshotStoreUnavailable`. */
  readSnapshot(): Promise<Snapshot>;
}

/** Loads a snapshot into an empty store, keeping its ids (ADR-005: dev and presentation only). */
export interface SnapshotLoader {
  /**
   * All or nothing. Throws `StoreNotEmpty` when any table already holds data,
   * `SnapshotRejected` when the store refuses the snapshot's contents and
   * `SnapshotStoreUnavailable` when the store cannot be reached.
   */
  loadIntoEmptyStore(snapshot: Snapshot): Promise<void>;
}

export class StoreNotEmpty extends Error {
  constructor(readonly nonEmptyTables: readonly string[]) {
    super(
      `The database already holds data (${nonEmptyTables.join(', ')}); import-data only loads into an empty database and never merges.`,
    );
    this.name = 'StoreNotEmpty';
  }
}

export class SnapshotRejected extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SnapshotRejected';
  }
}

export class SnapshotStoreUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SnapshotStoreUnavailable';
  }
}
