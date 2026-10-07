import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dataDirWarning } from './data-dir.mjs';

describe('dataDirWarning', () => {
  const linux = { platform: /** @type {NodeJS.Platform} */ ('linux'), hostUid: 1001, ownerUid: 1001, mode: 0o40755 };

  it('stays quiet on Docker Desktop platforms', () => {
    assert.equal(dataDirWarning({ ...linux, platform: 'darwin' }), null);
    assert.equal(dataDirWarning({ ...linux, platform: 'win32', hostUid: undefined }), null);
  });

  it('stays quiet when the host user or the owner is uid 1000', () => {
    assert.equal(dataDirWarning({ ...linux, hostUid: 1000, ownerUid: 1000 }), null);
    assert.equal(dataDirWarning({ ...linux, ownerUid: 1000 }), null);
  });

  it('stays quiet when the folder is world-writable', () => {
    assert.equal(dataDirWarning({ ...linux, mode: 0o40777 }), null);
  });

  it('warns with a setfacl fix when uid 1000 cannot write on Linux', () => {
    const warning = dataDirWarning(linux);
    assert.ok(warning);
    assert.match(warning, /setfacl -m u:1000:rwx/);
  });
});
