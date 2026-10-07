/** Injection token for the `DataExporter` port. */
export const DATA_EXPORTER = Symbol('DATA_EXPORTER');

/** Writes the complete, versioned `data/` export of everything in Postgres (ADR-005). */
export interface DataExporter {
  /** Replaces the export with the current state. Throws `DataExportFailed`. */
  exportAll(): Promise<void>;
}

export class DataExportFailed extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DataExportFailed';
  }
}
