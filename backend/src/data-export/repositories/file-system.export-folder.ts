import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { EXPORT_FILE_NAMES, type ExportFileName } from '../export-format';
import { ExportFileMissing, ExportFolderUnavailable, type ExportFile, type ExportFolder } from '../export-folder';

const KNOWN_FILES: ReadonlySet<string> = new Set(Object.values(EXPORT_FILE_NAMES));

/** Not `instanceof Error`: errors from Node's own modules can come from another realm (e.g. under Jest). */
function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

/**
 * The export folder on disk (`DATA_EXPORT_DIR`). Each file is written to a
 * temporary sibling, flushed, then renamed over the old one — an atomic
 * replace on the same filesystem — so a reader never sees a half-written file.
 */
export class FileSystemExportFolder implements ExportFolder {
  constructor(private readonly dir: string) {}

  async replaceFiles(files: readonly ExportFile[]): Promise<void> {
    for (const file of files) this.assertKnown(file.name);
    const staged: { readonly temp: string; readonly target: string }[] = [];
    try {
      await mkdir(this.dir, { recursive: true });
      const suffix = `${process.pid}-${randomBytes(6).toString('hex')}.tmp`;
      for (const file of files) {
        const temp = join(this.dir, `.${file.name}.${suffix}`);
        staged.push({ temp, target: join(this.dir, file.name) });
        await writeDurably(temp, file.content);
      }
      // Rename in order: the manifest comes last and marks the export complete.
      for (const { temp, target } of staged) await rename(temp, target);
      await syncDirectory(this.dir);
    } catch (error) {
      await Promise.all(staged.map(({ temp }) => unlink(temp).catch(() => undefined)));
      throw new ExportFolderUnavailable(`Cannot write the export to ${this.dir}`, { cause: error });
    }
  }

  async readFile(name: ExportFileName): Promise<string> {
    this.assertKnown(name);
    try {
      return await readFile(join(this.dir, name), 'utf8');
    } catch (error) {
      if (errorCode(error) === 'ENOENT') throw new ExportFileMissing(name);
      throw new ExportFolderUnavailable(`Cannot read ${name} from ${this.dir}`, { cause: error });
    }
  }

  /** Only the export's own file names ever reach the filesystem — never a path. */
  private assertKnown(name: string): void {
    if (!KNOWN_FILES.has(name)) throw new ExportFolderUnavailable(`${JSON.stringify(name)} is not an export file`);
  }
}

async function writeDurably(path: string, content: string): Promise<void> {
  const handle = await open(path, 'wx', 0o644);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Persists the renames themselves; some platforms cannot fsync a directory, which is harmless. */
async function syncDirectory(dir: string): Promise<void> {
  let handle;
  try {
    handle = await open(dir, 'r');
    await handle.sync();
  } catch {
    // EISDIR/EPERM/EINVAL on platforms without directory fsync: the files themselves are flushed.
  } finally {
    await handle?.close();
  }
}
