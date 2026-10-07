import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ExportFileName } from '../export-format';
import { ExportFileMissing, ExportFolderUnavailable } from '../export-folder';
import { FileSystemExportFolder } from './file-system.export-folder';

describe('FileSystemExportFolder', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'data-export-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('replaces files and leaves no temporary file behind', async () => {
    await writeFile(join(dir, 'companies.json'), 'old');
    const folder = new FileSystemExportFolder(dir);

    await folder.replaceFiles([
      { name: 'companies.json', content: '[]\n' },
      { name: 'manifest.json', content: '{}\n' },
    ]);

    expect(await readFile(join(dir, 'companies.json'), 'utf8')).toBe('[]\n');
    expect((await readdir(dir)).sort()).toEqual(['companies.json', 'manifest.json']);
  });

  it('keeps other files in the folder, such as alert files', async () => {
    await writeFile(join(dir, 'README.txt'), 'keep me');

    await new FileSystemExportFolder(dir).replaceFiles([{ name: 'runs.json', content: '[]' }]);

    expect(await readFile(join(dir, 'README.txt'), 'utf8')).toBe('keep me');
  });

  it('creates the folder when it does not exist yet', async () => {
    const nested = join(dir, 'data');

    await new FileSystemExportFolder(nested).replaceFiles([{ name: 'runs.json', content: '[]' }]);

    expect(await readFile(join(nested, 'runs.json'), 'utf8')).toBe('[]');
  });

  it('reads a file back', async () => {
    const folder = new FileSystemExportFolder(dir);
    await folder.replaceFiles([{ name: 'mentions.csv', content: '\uFEFFcompany\r\n' }]);

    await expect(folder.readFile('mentions.csv')).resolves.toBe('\uFEFFcompany\r\n');
  });

  it('reports a missing file as ExportFileMissing', async () => {
    await expect(new FileSystemExportFolder(dir).readFile('manifest.json')).rejects.toEqual(
      new ExportFileMissing('manifest.json'),
    );
  });

  it('refuses a name that is not an export file, so no path ever reaches the filesystem', async () => {
    const folder = new FileSystemExportFolder(dir);

    await expect(folder.readFile('../etc/passwd' as ExportFileName)).rejects.toBeInstanceOf(ExportFolderUnavailable);
    await expect(
      folder.replaceFiles([{ name: '../escape.json' as ExportFileName, content: 'x' }]),
    ).rejects.toBeInstanceOf(ExportFolderUnavailable);
    expect(await readdir(dir)).toEqual([]);
  });

  it('fails with ExportFolderUnavailable, keeps the old file and cleans up when it cannot write', async () => {
    const blocked = join(dir, 'not-a-folder');
    await writeFile(blocked, 'a file where the folder should be');

    await expect(
      new FileSystemExportFolder(blocked).replaceFiles([{ name: 'runs.json', content: '[]' }]),
    ).rejects.toBeInstanceOf(ExportFolderUnavailable);
    expect(await readFile(blocked, 'utf8')).toBe('a file where the folder should be');
    expect(await readdir(dir)).toEqual(['not-a-folder']);
  });
});
