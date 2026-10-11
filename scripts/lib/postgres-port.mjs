import { PrerequisiteError } from './errors.mjs';

/**
 * @typedef {object} PostgresPortChoice
 * @property {number} port Host port to publish Postgres on.
 * @property {'pinned' | 'running' | 'preferred' | 'fallback'} reason
 *   pinned: POSTGRES_HOST_PORT was set; running: the stack's Postgres already
 *   publishes it; preferred: the default was free; fallback: the default was
 *   taken, so the next free port was used.
 */

/**
 * Chooses the host port for the stack's Postgres. Nothing inside the stack
 * uses it (the containers reach Postgres on the compose network); it is only
 * for host-side tools, so when the user has not pinned one it can move to any
 * free port instead of failing on a native Postgres that holds 5432.
 *
 * A running Postgres keeps the port it has, so compose sees no change and does
 * not recreate it.
 *
 * @param {{ postgresPort: number, postgresPortPinned: boolean }} config
 * @param {{
 *   running: ReadonlySet<string>,
 *   publishedPort: () => number | null,
 *   findFreePort: (preferred: number) => Promise<number | null>,
 * }} deps
 * @returns {Promise<PostgresPortChoice>}
 * @throws {PrerequisiteError} when no free port is found.
 */
export async function choosePostgresPort(config, { running, publishedPort, findFreePort }) {
  if (config.postgresPortPinned) return { port: config.postgresPort, reason: 'pinned' };

  if (running.has('postgres')) {
    const current = publishedPort();
    if (current !== null) return { port: current, reason: 'running' };
  }

  const free = await findFreePort(config.postgresPort);
  if (free === null) {
    throw new PrerequisiteError(
      `No free port found for Postgres at or above ${config.postgresPort}.`,
      'Pick a free port and pin it, e.g. `POSTGRES_HOST_PORT=55432 npm start` (PowerShell: `$env:POSTGRES_HOST_PORT=55432; npm start`).',
    );
  }
  return { port: free, reason: free === config.postgresPort ? 'preferred' : 'fallback' };
}
