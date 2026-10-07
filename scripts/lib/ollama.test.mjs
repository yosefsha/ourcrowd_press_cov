import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isModelPulled, normalizeModelName } from './ollama.mjs';

describe('normalizeModelName', () => {
  it('adds the implicit :latest tag', () => {
    assert.equal(normalizeModelName('llama3'), 'llama3:latest');
    assert.equal(normalizeModelName('library/llama3'), 'library/llama3:latest');
  });

  it('keeps an explicit tag and ignores case and whitespace', () => {
    assert.equal(normalizeModelName(' Qwen2.5:7B '), 'qwen2.5:7b');
  });

  it('does not mistake a registry port for a tag', () => {
    assert.equal(normalizeModelName('registry:5000/llama3'), 'registry:5000/llama3:latest');
  });
});

describe('isModelPulled', () => {
  const tags = {
    models: [{ name: 'qwen2.5:7b', model: 'qwen2.5:7b' }, { name: 'llama3:latest' }, { model: 'phi3:mini' }],
  };

  it('finds a model by its exact name', () => {
    assert.equal(isModelPulled(tags, 'qwen2.5:7b'), true);
  });

  it('matches an untagged request against :latest', () => {
    assert.equal(isModelPulled(tags, 'llama3'), true);
  });

  it('falls back to the model field when name is absent', () => {
    assert.equal(isModelPulled(tags, 'phi3:mini'), true);
  });

  it('does not match a different tag of the same model', () => {
    assert.equal(isModelPulled(tags, 'qwen2.5:14b'), false);
  });

  for (const [label, body] of [
    ['null', null],
    ['no models key', {}],
    ['models not an array', { models: 'x' }],
    ['malformed entries', { models: [null, 42, { name: 7 }] }],
  ]) {
    it(`returns false for ${label}`, () => {
      assert.equal(isModelPulled(body, 'qwen2.5:7b'), false);
    });
  }
});
