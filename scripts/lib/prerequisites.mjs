import { PrerequisiteError, PrerequisiteErrors } from './errors.mjs';
import { capture } from './process.mjs';

export const MINIMUM_NODE_MAJOR = 22;

/**
 * @param {string} version A Node version string such as `22.20.0` or `v22.20.0`.
 * @returns {void}
 * @throws {PrerequisiteError} When the major version is below the minimum.
 */
export function checkNodeVersion(version) {
  const major = Number.parseInt(version.replace(/^v/, ''), 10);
  if (Number.isNaN(major) || major < MINIMUM_NODE_MAJOR) {
    throw new PrerequisiteError(
      `Node ${version} is too old; this project needs Node ${MINIMUM_NODE_MAJOR} or newer.`,
      `Install Node ${MINIMUM_NODE_MAJOR} LTS from https://nodejs.org/en/download (or \`nvm install ${MINIMUM_NODE_MAJOR}\`), then rerun.`,
    );
  }
}

/**
 * @param {NodeJS.Platform} platform
 * @returns {string}
 */
export function dockerInstallFix(platform) {
  if (platform === 'linux') {
    return 'Install Docker Engine with the Compose plugin: https://docs.docker.com/engine/install/';
  }
  return 'Install Docker Desktop: https://www.docker.com/products/docker-desktop/';
}

/**
 * @param {NodeJS.Platform} platform
 * @returns {string}
 */
export function dockerStartFix(platform) {
  if (platform === 'linux') return 'Start the Docker daemon: `sudo systemctl start docker`';
  return 'Start Docker Desktop and wait until it reports that the engine is running.';
}

/**
 * The install instruction for Ollama on this platform. Printed, never run:
 * these scripts do not install system software.
 *
 * @param {NodeJS.Platform} platform
 * @returns {string}
 */
export function ollamaInstallFix(platform) {
  if (platform === 'darwin') {
    return '`brew install ollama` (or download the app from https://ollama.com/download/mac), then rerun.';
  }
  if (platform === 'linux') {
    return '`curl -fsSL https://ollama.com/install.sh | sh` (see https://ollama.com/download/linux), then rerun.';
  }
  return 'Download and install Ollama from https://ollama.com/download/windows, then rerun.';
}

/**
 * Docker is installed, its engine is running and Compose v2 is available.
 *
 * @returns {void}
 * @throws {PrerequisiteError}
 */
export function checkDocker() {
  const info = capture('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (info.missing) {
    throw new PrerequisiteError('Docker is not installed.', dockerInstallFix(process.platform));
  }
  if (info.status !== 0 || info.stdout.trim() === '') {
    throw new PrerequisiteError(
      'Docker is installed but its engine is not running.',
      dockerStartFix(process.platform),
    );
  }
  const compose = capture('docker', ['compose', 'version']);
  if (compose.status !== 0) {
    throw new PrerequisiteError(
      'Docker Compose v2 (`docker compose`) is not available.',
      process.platform === 'linux'
        ? 'Install the Compose plugin: https://docs.docker.com/compose/install/linux/'
        : 'Update Docker Desktop to a current release, which bundles Compose v2.',
    );
  }
}

/**
 * The `ollama` CLI is on the PATH.
 *
 * @returns {void}
 * @throws {PrerequisiteError}
 */
export function checkOllamaInstalled() {
  const result = capture('ollama', ['--version']);
  if (result.missing) {
    throw new PrerequisiteError(
      'Ollama is not installed (no `ollama` command on the PATH).',
      ollamaInstallFix(process.platform),
    );
  }
}

/**
 * Runs every check and reports all failures together rather than one per run.
 *
 * @param {ReadonlyArray<() => void>} checks
 * @returns {void}
 * @throws {PrerequisiteErrors}
 */
export function checkAll(checks) {
  /** @type {PrerequisiteError[]} */
  const failures = [];
  for (const check of checks) {
    try {
      check();
    } catch (error) {
      if (!(error instanceof PrerequisiteError)) throw error;
      failures.push(error);
    }
  }
  if (failures.length > 0) throw new PrerequisiteErrors(failures);
}

/**
 * The host prerequisites every orchestration command needs.
 *
 * @returns {void}
 * @throws {PrerequisiteErrors}
 */
export function checkHostPrerequisites() {
  checkAll([() => checkNodeVersion(process.versions.node), checkDocker, checkOllamaInstalled]);
}
