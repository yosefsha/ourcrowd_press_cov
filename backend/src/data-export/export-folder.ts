import type { ExportFileName } from './export-format';

/** Injection token for the `ExportFolder` port. */
export const EXPORT_FOLDER = Symbol('EXPORT_FOLDER');

/** One file of an export, fully rendered. */
export interface ExportFile {
  readonly name: ExportFileName;
  readonly content: string;
}

/** Where the `data/` export lives. */
export interface ExportFolder {
  /**
   * Replaces the given files. Each file is replaced atomically (a reader sees
   * the old or the new content, never a partial write) and in the given order,
   * so the caller puts the manifest last. Throws `ExportFolderUnavailable`.
   */
  replaceFiles(files: readonly ExportFile[]): Promise<void>;
  /** Throws `ExportFileMissing` or `ExportFolderUnavailable`. */
  readFile(name: ExportFileName): Promise<string>;
}

export class ExportFileMissing extends Error {
  constructor(readonly fileName: ExportFileName) {
    super(`The export has no ${fileName}`);
    this.name = 'ExportFileMissing';
  }
}

export class ExportFolderUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ExportFolderUnavailable';
  }
}
