import { spawn } from 'node:child_process';
import readline from 'node:readline';

/**
 * @typedef {object} ProcessSpec
 * @property {string} name Short label prefixed to every output line.
 * @property {string} command
 * @property {readonly string[]} args
 * @property {string} cwd
 * @property {Record<string, string>} [env] Merged over process.env.
 */

/**
 * Prefixes a line of child output with its process label, padded so that the
 * columns of several processes line up.
 *
 * @param {string} name
 * @param {number} width
 * @param {string} line
 * @returns {string}
 */
export function prefixLine(name, width, line) {
  return `[${name.padEnd(width)}] ${line}`;
}

/**
 * Runs several long-lived processes side by side with labelled output, the
 * way `npm run dev` needs them. Ctrl+C (or any one process exiting) stops all
 * of them; the returned promise resolves with the exit code to use.
 *
 * Every command is spawned directly — no shell, no npm wrapper — so a kill
 * reaches the real process on every platform.
 *
 * @param {readonly ProcessSpec[]} specs
 * @returns {Promise<number>}
 */
export function supervise(specs) {
  const width = Math.max(...specs.map((spec) => spec.name.length));
  const color = process.stdout.isTTY ? { FORCE_COLOR: '1' } : {};
  /** @type {Set<import('node:child_process').ChildProcess>} */
  const alive = new Set();
  let exitCode = 0;
  let stopping = false;

  return new Promise((resolve) => {
    const stopAll = () => {
      stopping = true;
      for (const child of alive) child.kill('SIGTERM');
    };

    const onSignal = () => {
      if (!stopping) console.log('\nStopping…');
      stopAll();
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    for (const spec of specs) {
      const child = spawn(spec.command, [...spec.args], {
        cwd: spec.cwd,
        env: { ...process.env, ...color, ...spec.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      alive.add(child);

      for (const stream of [child.stdout, child.stderr]) {
        readline
          .createInterface({ input: stream })
          .on('line', (line) => console.log(prefixLine(spec.name, width, line)));
      }

      child.once('error', (error) => {
        console.error(prefixLine(spec.name, width, `failed to start: ${error.message}`));
      });

      child.once('close', (code, signal) => {
        alive.delete(child);
        if (!stopping) {
          console.error(
            prefixLine(spec.name, width, `exited (${signal ?? `code ${code}`}); stopping the others`),
          );
          exitCode = 1;
          stopAll();
        }
        if (alive.size === 0) {
          process.off('SIGINT', onSignal);
          process.off('SIGTERM', onSignal);
          resolve(exitCode);
        }
      });
    }
  });
}
