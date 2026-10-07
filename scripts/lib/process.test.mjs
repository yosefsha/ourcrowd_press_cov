import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { capture, npmInvocation, run } from './process.mjs';
import { CommandFailedError } from './errors.mjs';

describe('npmInvocation', () => {
  it('runs npm-cli.js through the current Node when launched by npm', () => {
    const invocation = npmInvocation(
      { npm_execpath: '/usr/lib/node_modules/npm/bin/npm-cli.js' },
      'linux',
      '/usr/bin/node',
    );
    assert.deepEqual(invocation, {
      command: '/usr/bin/node',
      args: ['/usr/lib/node_modules/npm/bin/npm-cli.js'],
      shell: false,
    });
  });

  it('ignores a non-npm execpath (yarn, pnpm) and falls back to the PATH', () => {
    const invocation = npmInvocation({ npm_execpath: '/opt/yarn.js' }, 'darwin', '/usr/bin/node');
    assert.deepEqual(invocation, { command: 'npm', args: [], shell: false });
  });

  it('spawns the .cmd shim through a shell on Windows', () => {
    assert.deepEqual(npmInvocation({}, 'win32', 'C:\\node.exe'), {
      command: 'npm.cmd',
      args: [],
      shell: true,
    });
  });
});

describe('capture', () => {
  it('reports a missing executable instead of throwing', () => {
    const result = capture('definitely-not-a-real-command-17', ['--version']);
    assert.equal(result.missing, true);
  });

  it('returns the exit status and output of a real command', () => {
    const result = capture(process.execPath, ['-e', 'console.log("hi"); process.exit(3)']);
    assert.equal(result.missing, false);
    assert.equal(result.status, 3);
    assert.equal(result.stdout.trim(), 'hi');
  });
});

describe('run', () => {
  it('succeeds silently on exit code 0', () => {
    assert.doesNotThrow(() => run({ command: process.execPath, args: ['-e', ''], shell: false }));
  });

  it('throws CommandFailedError with the exit code on failure', () => {
    assert.throws(
      () => run({ command: process.execPath, args: ['-e', 'process.exit(4)'], shell: false }),
      (error) => error instanceof CommandFailedError && error.status === 4,
    );
  });
});
