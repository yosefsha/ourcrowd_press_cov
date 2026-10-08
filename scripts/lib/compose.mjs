import { REPO_ROOT } from './config.mjs';
import { PrerequisiteError, PrerequisiteErrors } from './errors.mjs';
import { isPortFree } from './net.mjs';
import { capture, run } from './process.mjs';

/**
 * Runs `docker compose <args>` from the repository root, terminal attached.
 * Compose reads COMPOSE_PROJECT_NAME and the *_HOST_PORT overrides from the
 * environment itself.
 *
 * @param {readonly string[]} args
 * @param {Record<string, string>} [env] Variables for compose interpolation, merged over process.env.
 * @returns {void}
 */
export function compose(args, env = {}) {
  run({ command: 'docker', args: ['compose', ...args], shell: false }, { cwd: REPO_ROOT, env });
}

/**
 * Names of this project's compose services that are currently running.
 *
 * @returns {ReadonlySet<string>}
 */
export function runningServices() {
  const result = capture('docker', ['compose', 'ps', '--status', 'running', '--services'], {
    cwd: REPO_ROOT,
  });
  if (result.status !== 0) return new Set();
  return new Set(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  );
}

/**
 * @typedef {object} PortClaim
 * @property {number} port
 * @property {string} label What listens there, for the error message.
 * @property {string} fix How to move or free it.
 * @property {string} [service] Compose service that owns the port; if it is
 *   already running, the port is busy because of us and that is fine.
 */

/**
 * Fails up front, with the override to use, when a port this command needs is
 * taken by something else — instead of a mid-way Docker "port is already
 * allocated" error.
 *
 * @param {readonly PortClaim[]} claims
 * @param {ReadonlySet<string>} running
 * @returns {Promise<void>}
 * @throws {PrerequisiteErrors}
 */
export async function ensurePortsAvailable(claims, running) {
  /** @type {PrerequisiteError[]} */
  const failures = [];
  for (const claim of claims) {
    if (claim.service && running.has(claim.service)) continue;
    if (!(await isPortFree(claim.port))) {
      failures.push(
        new PrerequisiteError(`Port ${claim.port} (${claim.label}) is already in use.`, claim.fix),
      );
    }
  }
  if (failures.length > 0) throw new PrerequisiteErrors(failures);
}

/**
 * The fix for a busy port that a compose override variable can move.
 *
 * @param {string} envVar
 * @param {number} port
 * @param {string} command The npm command to rerun, e.g. `npm start`.
 * @returns {string}
 */
export function overrideFix(envVar, port, command) {
  return [
    `Stop whatever listens on ${port}, or publish on another port, e.g.`,
    `  macOS/Linux:  ${envVar}=${port + 1} ${command}`,
    `  PowerShell:   $env:${envVar}=${port + 1}; ${command}`,
  ].join('\n');
}
