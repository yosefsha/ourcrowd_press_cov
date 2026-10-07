import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PrerequisiteError, PrerequisiteErrors } from './errors.mjs';
import {
  checkAll,
  checkNodeVersion,
  dockerInstallFix,
  dockerStartFix,
  ollamaInstallFix,
} from './prerequisites.mjs';

describe('checkNodeVersion', () => {
  for (const version of ['22.0.0', 'v22.20.0', '24.1.0']) {
    it(`accepts ${version}`, () => {
      assert.doesNotThrow(() => checkNodeVersion(version));
    });
  }

  for (const version of ['20.11.1', 'v18.0.0', 'garbage']) {
    it(`rejects ${version} with an install fix`, () => {
      assert.throws(
        () => checkNodeVersion(version),
        (error) => error instanceof PrerequisiteError && error.fix.includes('nodejs.org'),
      );
    });
  }
});

describe('install fixes', () => {
  it('suggests Homebrew or the download page for Ollama on macOS', () => {
    const fix = ollamaInstallFix('darwin');
    assert.match(fix, /brew install ollama/);
    assert.match(fix, /https:\/\/ollama\.com\/download/);
  });

  it('suggests the install script on Linux and the installer on Windows', () => {
    assert.match(ollamaInstallFix('linux'), /ollama\.com\/install\.sh/);
    assert.match(ollamaInstallFix('win32'), /ollama\.com\/download\/windows/);
  });

  it('points Linux at Docker Engine and everything else at Docker Desktop', () => {
    assert.match(dockerInstallFix('linux'), /docs\.docker\.com\/engine\/install/);
    assert.match(dockerInstallFix('darwin'), /docker-desktop/);
    assert.match(dockerStartFix('linux'), /systemctl start docker/);
    assert.match(dockerStartFix('win32'), /Docker Desktop/);
  });
});

describe('checkAll', () => {
  it('passes when every check passes', () => {
    assert.doesNotThrow(() => checkAll([() => {}, () => {}]));
  });

  it('runs every check and reports all failures together', () => {
    let ran = 0;
    const fail = (/** @type {string} */ what) => () => {
      ran += 1;
      throw new PrerequisiteError(`${what} missing`, `install ${what}`);
    };
    assert.throws(
      () => checkAll([fail('a'), () => (ran += 1), fail('b')]),
      (error) =>
        error instanceof PrerequisiteErrors &&
        error.errors.map((e) => e.problem).join(',') === 'a missing,b missing',
    );
    assert.equal(ran, 3);
  });

  it('does not swallow unexpected errors', () => {
    assert.throws(
      () =>
        checkAll([
          () => {
            throw new TypeError('bug');
          },
        ]),
      TypeError,
    );
  });
});
