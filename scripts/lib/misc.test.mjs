import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatPrerequisiteError } from './cli.mjs';
import { overrideFix } from './compose.mjs';
import { PrerequisiteError } from './errors.mjs';
import { definesScript } from './manifest.mjs';
import { prefixLine, supervise } from './supervisor.mjs';

describe('formatPrerequisiteError', () => {
  it('prints the problem and an indented multi-line fix', () => {
    const text = formatPrerequisiteError(new PrerequisiteError('Port busy.', 'line one\nline two'));
    assert.equal(text, '  x Port busy.\n    Fix: line one\n         line two');
  });
});

describe('overrideFix', () => {
  it('names the override variable for POSIX shells and PowerShell', () => {
    const fix = overrideFix('POSTGRES_HOST_PORT', 5432, 'npm start');
    assert.match(fix, /POSTGRES_HOST_PORT=5433 npm start/);
    assert.match(fix, /\$env:POSTGRES_HOST_PORT=5433; npm start/);
  });
});

describe('definesScript', () => {
  it('finds a defined script', () => {
    assert.equal(definesScript({ scripts: { 'import-data': 'node x' } }, 'import-data'), true);
  });

  for (const [label, manifest] of [
    ['a missing script', { scripts: { build: 'x' } }],
    ['no scripts block', {}],
    ['a non-string script', { scripts: { 'import-data': 1 } }],
    ['null', null],
  ]) {
    it(`returns false for ${label}`, () => {
      assert.equal(definesScript(manifest, 'import-data'), false);
    });
  }
});

describe('prefixLine', () => {
  it('pads labels so columns line up', () => {
    assert.equal(prefixLine('api', 9, 'listening'), '[api      ] listening');
  });
});

describe('supervise', () => {
  it('stops the others and resolves 1 when one process exits on its own', async () => {
    const started = Date.now();
    const code = await supervise([
      { name: 'quits', command: process.execPath, args: ['-e', 'process.exit(0)'], cwd: process.cwd() },
      {
        name: 'lingers',
        command: process.execPath,
        args: ['-e', 'setTimeout(() => {}, 60000)'],
        cwd: process.cwd(),
      },
    ]);
    assert.equal(code, 1);
    assert.ok(Date.now() - started < 10_000);
  });
});
