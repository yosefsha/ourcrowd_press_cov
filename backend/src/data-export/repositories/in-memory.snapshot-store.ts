import type { Snapshot } from '../export-format';
import { StoreNotEmpty, type SnapshotLoader, type SnapshotReader } from '../snapshot-store';

const EMPTY: Snapshot = { companies: [], articles: [], candidates: [], runs: [], alertDigests: [] };

/** `SnapshotReader` and `SnapshotLoader` held in memory, for tests. */
export class InMemorySnapshotStore implements SnapshotReader, SnapshotLoader {
  constructor(private snapshot: Snapshot = EMPTY) {}

  readSnapshot(): Promise<Snapshot> {
    return Promise.resolve(this.snapshot);
  }

  loadIntoEmptyStore(snapshot: Snapshot): Promise<void> {
    const nonEmpty = (Object.keys(this.snapshot) as (keyof Snapshot)[]).filter(
      (key) => this.snapshot[key].length > 0,
    );
    if (nonEmpty.length > 0) return Promise.reject(new StoreNotEmpty(nonEmpty));
    this.snapshot = snapshot;
    return Promise.resolve();
  }
}
