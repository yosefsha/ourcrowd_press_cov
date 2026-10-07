import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { CommandFailedError } from './errors.mjs';

/**
 * @typedef {object} Invocation
 * @property {string} command Executable to spawn.
 * @property {readonly string[]} args Arguments that precede the caller's own.
 * @property {boolean} shell Whether the executable needs a shell (Windows .cmd shims).
 */

/**
 * How to invoke npm portably. Under `npm run`, npm exposes its own CLI script
 * as `npm_execpath`, which runs through the current Node binary on every
 * platform. Run directly with `node`, fall back to `npm` on the PATH — a .cmd
 * shim on Windows, which Node only spawns through a shell.
 *
 * @param {Record<string, string | undefined>} env
 * @param {NodeJS.Platform} platform
 * @param {string} nodePath
 * @returns {Invocation}
 */
export function npmInvocation(env, platform, nodePath) {
  const execPath = env.npm_execpath;
  if (execPath && /^npm-cli\.c?js$/.test(path.basename(execPath))) {
    return { command: nodePath, args: [execPath], shell: false };
  }
  return platform === 'win32'
    ? { command: 'npm.cmd', args: [], shell: true }
    : { command: 'npm', args: [], shell: false };
}

/**
 * @param {readonly string[]} args
 * @returns {Invocation}
 */
export function npm(args) {
  const base = npmInvocation(process.env, process.platform, process.execPath);
  return { ...base, args: [...base.args, ...args] };
}

/**
 * @typedef {object} RunOptions
 * @property {string} [cwd]
 * @property {Record<string, string | undefined>} [env] Merged over process.env.
 */

/**
 * Runs a command with the terminal attached and throws if it fails.
 *
 * @param {Invocation} invocation
 * @param {RunOptions} [options]
 * @returns {void}
 */
export function run(invocation, options = {}) {
  const result = spawnSync(invocation.command, [...invocation.args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    shell: invocation.shell,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new CommandFailedError(describe(invocation), result.status);
  }
}

/**
 * @typedef {object} Captured
 * @property {boolean} missing The executable is not on the PATH.
 * @property {number | null} status
 * @property {string} stdout
 * @property {string} stderr
 */

/**
 * Error codes meaning "no such executable on the PATH". ENOTDIR is what the
 * lookup reports when the PATH contains a regular file rather than a directory.
 */
const NOT_FOUND_CODES = new Set(['ENOENT', 'ENOTDIR']);

/**
 * Runs a command silently and returns its output. Never throws for a missing
 * executable or a non-zero exit — the caller decides what those mean.
 *
 * @param {string} command
 * @param {readonly string[]} args
 * @param {RunOptions} [options]
 * @returns {Captured}
 */
export function capture(command, args, options = {}) {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const code = /** @type {NodeJS.ErrnoException | undefined} */ (result.error)?.code;
  const missing = code !== undefined && NOT_FOUND_CODES.has(code);
  if (result.error && !missing) throw result.error;
  return {
    missing,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * @param {Invocation} invocation
 * @returns {string}
 */
function describe(invocation) {
  const args = invocation.args.filter((arg) => !arg.endsWith('npm-cli.js'));
  const command = invocation.command === process.execPath ? 'npm' : invocation.command;
  return [command, ...args].join(' ');
}
