import { readFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from './config.mjs';

/**
 * Whether a parsed package.json defines the given npm script.
 *
 * @param {unknown} manifest
 * @param {string} script
 * @returns {boolean}
 */
export function definesScript(manifest, script) {
  if (typeof manifest !== 'object' || manifest === null || !('scripts' in manifest)) return false;
  const { scripts } = manifest;
  return (
    typeof scripts === 'object' && scripts !== null && typeof Reflect.get(scripts, script) === 'string'
  );
}

/**
 * Reads a service's package.json (`backend` or `frontend`).
 *
 * @param {string} service
 * @returns {unknown}
 */
export function readServiceManifest(service) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, service, 'package.json'), 'utf8'));
}
