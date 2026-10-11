import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parsePublishedPort } from './compose.mjs';
import { PrerequisiteError } from './errors.mjs';
import { findFreePort } from './net.mjs';
import { choosePostgresPort } from './postgres-port.mjs';

const unpinned = { postgresPort: 5432, postgresPortPinned: false };
const neverCalled = () => {
  throw new Error('should not be called');
};

describe('choosePostgresPort', () => {
  it('uses a pinned port as is, without probing', async () => {
    const choice = await choosePostgresPort(
      { postgresPort: 5433, postgresPortPinned: true },
      { running: new Set(['postgres']), publishedPort: neverCalled, findFreePort: neverCalled },
    );
    assert.deepEqual(choice, { port: 5433, reason: 'pinned' });
  });

  it('keeps the port a running Postgres already publishes', async () => {
    const choice = await choosePostgresPort(unpinned, {
      running: new Set(['postgres', 'api']),
      publishedPort: () => 5434,
      findFreePort: neverCalled,
    });
    assert.deepEqual(choice, { port: 5434, reason: 'running' });
  });

  it('uses the default port when it is free', async () => {
    const choice = await choosePostgresPort(unpinned, {
      running: new Set(),
      publishedPort: neverCalled,
      findFreePort: async (preferred) => preferred,
    });
    assert.deepEqual(choice, { port: 5432, reason: 'preferred' });
  });

  it('falls back to the next free port when the default is taken', async () => {
    const choice = await choosePostgresPort(unpinned, {
      running: new Set(),
      publishedPort: neverCalled,
      findFreePort: async () => 5433,
    });
    assert.deepEqual(choice, { port: 5433, reason: 'fallback' });
  });

  it('probes for a free port when a running Postgres publishes none', async () => {
    const choice = await choosePostgresPort(unpinned, {
      running: new Set(['postgres']),
      publishedPort: () => null,
      findFreePort: async () => 5435,
    });
    assert.deepEqual(choice, { port: 5435, reason: 'fallback' });
  });

  it('fails with a fix when no port is free', async () => {
    await assert.rejects(
      choosePostgresPort(unpinned, {
        running: new Set(),
        publishedPort: neverCalled,
        findFreePort: async () => null,
      }),
      (error) => error instanceof PrerequisiteError && error.fix.includes('POSTGRES_HOST_PORT='),
    );
  });
});

describe('findFreePort', () => {
  it('returns the first free port at or above the preferred one', async () => {
    const taken = new Set([5432, 5433]);
    const port = await findFreePort(5432, { isFree: async (p) => !taken.has(p) });
    assert.equal(port, 5434);
  });

  it('returns null when every port tried is taken', async () => {
    const port = await findFreePort(5432, { attempts: 3, isFree: async () => false });
    assert.equal(port, null);
  });
});

describe('parsePublishedPort', () => {
  for (const [output, expected] of [
    ['127.0.0.1:5433\n', 5433],
    ['[::1]:5433', 5433],
    ['', null],
    ['not a port', null],
  ]) {
    it(`parses ${JSON.stringify(output)} as ${expected}`, () => {
      assert.equal(parsePublishedPort(output), expected);
    });
  }
});
