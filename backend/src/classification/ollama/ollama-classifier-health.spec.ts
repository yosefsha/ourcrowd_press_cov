import { ClassifierUnavailable } from '../classifier-errors';
import { isModelPulled, OllamaClassifierHealth } from './ollama-classifier-health';
import type { OllamaClient } from './ollama.client';

function clientListing(result: string[] | Error): OllamaClient {
  return {
    model: 'qwen2.5:7b',
    serverUrl: 'http://localhost:11434',
    listModelNames: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
  } as unknown as OllamaClient;
}

describe('isModelPulled', () => {
  it('matches an exact name', () => {
    expect(isModelPulled(['qwen2.5:7b'], 'qwen2.5:7b')).toBe(true);
  });

  it('treats an untagged name as :latest', () => {
    expect(isModelPulled(['qwen2.5:latest'], 'qwen2.5')).toBe(true);
  });

  it('does not match a different tag', () => {
    expect(isModelPulled(['qwen2.5:14b', 'qwen2.5:latest'], 'qwen2.5:7b')).toBe(false);
  });
});

describe('OllamaClassifierHealth', () => {
  it('is ok when the configured model is pulled', async () => {
    await expect(new OllamaClassifierHealth(clientListing(['qwen2.5:7b'])).check()).resolves.toEqual({
      ok: true,
      model: 'qwen2.5:7b',
    });
  });

  it('tells to pull the model when it is missing', async () => {
    const status = await new OllamaClassifierHealth(clientListing(['llama3.2:latest'])).check();

    expect(status).toEqual({
      ok: false,
      model: 'qwen2.5:7b',
      detail: 'Ollama at http://localhost:11434 does not have the model qwen2.5:7b. Run `ollama pull qwen2.5:7b`.',
    });
  });

  it('tells to start Ollama when it is unreachable', async () => {
    const status = await new OllamaClassifierHealth(clientListing(new ClassifierUnavailable('fetch failed'))).check();

    expect(status.ok).toBe(false);
    expect(!status.ok && status.detail).toContain('Ollama is not reachable at http://localhost:11434 (fetch failed)');
    expect(!status.ok && status.detail).toContain('`ollama pull qwen2.5:7b`');
  });

  it('lets an unexpected error through', async () => {
    await expect(new OllamaClassifierHealth(clientListing(new TypeError('bug'))).check()).rejects.toThrow('bug');
  });
});
