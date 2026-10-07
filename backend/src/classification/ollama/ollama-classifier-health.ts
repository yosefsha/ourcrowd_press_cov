import { Inject, Injectable } from '@nestjs/common';

import { ClassifierUnavailable } from '../classifier-errors';
import type { ClassifierHealth, ClassifierHealthStatus } from '../classifier-health';
import { OllamaClient } from './ollama.client';

/** `qwen2.5` and `qwen2.5:latest` name the same model; an explicit tag must match exactly. */
export function isModelPulled(pulled: readonly string[], model: string): boolean {
  const withTag = model.includes(':') ? model : `${model}:latest`;
  return pulled.some((name) => name === model || name === withTag);
}

/** Ollama is healthy when `/api/tags` answers and lists `OLLAMA_MODEL`. */
@Injectable()
export class OllamaClassifierHealth implements ClassifierHealth {
  constructor(@Inject(OllamaClient) private readonly client: OllamaClient) {}

  async check(): Promise<ClassifierHealthStatus> {
    const { model, serverUrl } = this.client;
    let pulled: string[];
    try {
      pulled = await this.client.listModelNames();
    } catch (error) {
      if (!(error instanceof ClassifierUnavailable)) throw error;
      return {
        ok: false,
        model,
        detail:
          `Ollama is not reachable at ${serverUrl} (${error.message}). Start Ollama on the host ` +
          `(\`ollama serve\` or the Ollama app), run \`ollama pull ${model}\`, and check OLLAMA_BASE_URL.`,
      };
    }
    if (!isModelPulled(pulled, model)) {
      return {
        ok: false,
        model,
        detail: `Ollama at ${serverUrl} does not have the model ${model}. Run \`ollama pull ${model}\`.`,
      };
    }
    return { ok: true, model };
  }
}
