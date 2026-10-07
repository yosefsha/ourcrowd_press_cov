import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_OLLAMA_MODEL, resolveConfig } from './config.mjs';
import { PrerequisiteError } from './errors.mjs';

describe('resolveConfig', () => {
  it('uses the compose defaults when nothing is set', () => {
    assert.deepEqual(resolveConfig({}), {
      postgresPort: 5432,
      apiPort: 8000,
      frontendPort: 8080,
      ollamaModel: DEFAULT_OLLAMA_MODEL,
    });
  });

  it('reads the same override variables docker-compose.yml interpolates', () => {
    const config = resolveConfig({
      POSTGRES_HOST_PORT: '55432',
      API_HOST_PORT: '58000',
      FRONTEND_HOST_PORT: '58080',
      OLLAMA_MODEL: 'llama3.1:8b',
    });
    assert.equal(config.postgresPort, 55432);
    assert.equal(config.apiPort, 58000);
    assert.equal(config.frontendPort, 58080);
    assert.equal(config.ollamaModel, 'llama3.1:8b');
  });

  it('treats empty values as unset', () => {
    const config = resolveConfig({ FRONTEND_HOST_PORT: '', OLLAMA_MODEL: '  ' });
    assert.equal(config.frontendPort, 8080);
    assert.equal(config.ollamaModel, DEFAULT_OLLAMA_MODEL);
  });

  for (const bad of ['abc', '0', '65536', '80.5', '-1']) {
    it(`rejects FRONTEND_HOST_PORT=${bad} with a fix`, () => {
      assert.throws(
        () => resolveConfig({ FRONTEND_HOST_PORT: bad }),
        (error) =>
          error instanceof PrerequisiteError &&
          error.problem.includes('FRONTEND_HOST_PORT') &&
          error.fix.includes('between 1 and 65535'),
      );
    });
  }
});
