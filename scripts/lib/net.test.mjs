import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';

import { isPortFree, respondsOk, waitForOk } from './net.mjs';

describe('network helpers', () => {
  /** @type {http.Server} */
  let server;
  let port = 0;

  before(async () => {
    server = http.createServer((req, res) => {
      res.statusCode = req.url === '/health' ? 200 : 503;
      res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 0;
  });

  after(() => new Promise((resolve) => server.close(() => resolve(undefined))));

  it('sees a listening port as taken', async () => {
    assert.equal(await isPortFree(port), false);
  });

  it('sees a closed port as free', async () => {
    const probe = http.createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', () => resolve(undefined)));
    const address = probe.address();
    const freePort = typeof address === 'object' && address ? address.port : 0;
    await new Promise((resolve) => probe.close(() => resolve(undefined)));
    assert.equal(await isPortFree(freePort), true);
  });

  it('distinguishes 2xx from error statuses and unreachable hosts', async () => {
    assert.equal(await respondsOk(`http://127.0.0.1:${port}/health`), true);
    assert.equal(await respondsOk(`http://127.0.0.1:${port}/other`), false);
    assert.equal(await respondsOk('http://127.0.0.1:1/health', 500), false);
  });

  it('waitForOk returns true once the URL is healthy and false at the deadline', async () => {
    assert.equal(await waitForOk(`http://127.0.0.1:${port}/health`, { timeoutMs: 1000 }), true);
    const started = Date.now();
    assert.equal(
      await waitForOk(`http://127.0.0.1:${port}/other`, { timeoutMs: 300, intervalMs: 100 }),
      false,
    );
    assert.ok(Date.now() - started < 2000);
  });
});
