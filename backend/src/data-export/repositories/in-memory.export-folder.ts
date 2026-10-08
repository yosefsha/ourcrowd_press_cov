import type { ExportFileName } from '../export-format';
import { ExportFileMissing, type ExportFile, type ExportFolder } from '../export-folder';

/** `ExportFolder` held in memory, for tests. */
export class InMemoryExportFolder implements ExportFolder {
  private readonly files = new Map<ExportFileName, string>();

  /** Names in the order they were last written. */
  readonly writeOrder: ExportFileName[] = [];

  replaceFiles(files: readonly ExportFile[]): Promise<void> {
    for (const file of files) {
      this.files.set(file.name, file.content);
      this.writeOrder.push(file.name);
    }
    return Promise.resolve();
  }

  readFile(name: ExportFileName): Promise<string> {
    const content = this.files.get(name);
    return content === undefined ? Promise.reject(new ExportFileMissing(name)) : Promise.resolve(content);
  }

  /** Test helper: the current content of a file, if any. */
  peek(name: ExportFileName): string | undefined {
    return this.files.get(name);
  }
}
