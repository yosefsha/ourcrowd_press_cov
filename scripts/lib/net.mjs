import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Whether nothing is listening on the port on the loopback interface, where
 * docker-compose.yml publishes every service.
 *
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export function isPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (/** @type {NodeJS.ErrnoException} */ error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(false);
      else reject(error);
    });
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen({ port, host: '127.0.0.1', exclusive: true });
  });
}

/**
 * Fetches a URL and reports whether it answered 2xx within the timeout.
 *
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export async function respondsOk(url, timeoutMs = 2000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Polls a URL until it answers 2xx or the deadline passes.
 *
 * @param {string} url
 * @param {{ timeoutMs: number, intervalMs?: number }} options
 * @returns {Promise<boolean>} Whether the URL came up in time.
 */
export async function waitForOk(url, { timeoutMs, intervalMs = 1000 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await respondsOk(url)) return true;
    if (Date.now() + intervalMs > deadline) return false;
    await sleep(intervalMs);
  }
}
