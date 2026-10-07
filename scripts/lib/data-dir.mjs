import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { ok } from './cli.mjs';
import { REPO_ROOT } from './config.mjs';

/** Host folder bind-mounted into the api and collector at /app/data. */
export const DATA_DIR = path.join(REPO_ROOT, 'data');

/** uid of the `node` user the backend image runs as. */
export const CONTAINER_UID = 1000;

/**
 * @typedef {object} DataDirFacts
 * @property {NodeJS.Platform} platform
 * @property {number | undefined} hostUid The uid running the script (undefined on Windows).
 * @property {number} ownerUid
 * @property {number} mode
 */

/**
 * Whether the container user may be unable to write the data folder. Only a
 * Linux host matters: Docker Desktop (macOS, Windows) maps bind-mount
 * ownership, while Linux enforces host permissions on uid 1000.
 *
 * @param {DataDirFacts} facts
 * @returns {string | null} A warning with the fix, or null when writes will work.
 */
export function dataDirWarning({ platform, hostUid, ownerUid, mode }) {
  if (platform !== 'linux') return null;
  if (hostUid === CONTAINER_UID || ownerUid === CONTAINER_UID) return null;
  if ((mode & 0o002) !== 0) return null;
  return [
    `data/ is not owned by uid ${CONTAINER_UID}, which the backend container runs as, so the collector may fail to write exports.`,
    `Fix: grant it access without changing ownership: \`setfacl -m u:${CONTAINER_UID}:rwx,d:u:${CONTAINER_UID}:rwx data\``,
    '(If ACLs are already granted, ignore this warning.)',
  ].join('\n    ');
}

/**
 * Creates data/ if missing, so Docker does not create the bind-mount source
 * as root, and warns when the container user may not be able to write it.
 *
 * @returns {void}
 */
export function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
  const stats = statSync(DATA_DIR);
  const warning = dataDirWarning({
    platform: process.platform,
    hostUid: process.getuid?.(),
    ownerUid: stats.uid,
    mode: stats.mode,
  });
  if (warning) console.warn(`    !   ${warning}`);
  else ok(`data/ is ready (${DATA_DIR})`);
}
