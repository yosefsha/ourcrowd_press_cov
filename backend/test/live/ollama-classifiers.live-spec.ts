import { join } from 'node:path';

import { OllamaAmbiguityTriage } from '../../src/classification/ollama/ollama-ambiguity.triage';
import { OllamaClassifierHealth } from '../../src/classification/ollama/ollama-classifier-health';
import { OLLAMA_REQUEST_TIMEOUT_MS, OllamaClient } from '../../src/classification/ollama/ollama.client';
import { OllamaRelevanceClassifier } from '../../src/classification/ollama/ollama-relevance.classifier';
import { OllamaSentimentClassifier } from '../../src/classification/ollama/ollama-sentiment.classifier';
import { loadRecording } from '../../src/classification/recorded/recorded-verdicts';
import { configuration } from '../../src/config/configuration';

/**
 * Real Ollama (`npm run test:live`, never in CI — ADR-006): the configured
 * model answers with readable verdicts, and still agrees with a handful of the
 * recorded fixtures. A disagreement means model or prompt drift: re-record the
 * fixtures (`record-verdicts`) after checking the new verdicts are right.
 */
const FIXTURES = join(__dirname, '..', 'fixtures', 'ollama');
const SAMPLE_SIZE = 5;
const LIVE_TIMEOUT_MS = 10 * 60_000;

jest.setTimeout(LIVE_TIMEOUT_MS);

const { ollama } = configuration();
const client = new OllamaClient({
  baseUrl: ollama.baseUrl,
  model: ollama.model,
  numParallel: ollama.numParallel,
  timeoutMs: OLLAMA_REQUEST_TIMEOUT_MS,
});

describe('Ollama classifiers (live)', () => {
  it('reaches Ollama with the configured model pulled', async () => {
    await expect(new OllamaClassifierHealth(client).check()).resolves.toEqual({ ok: true, model: ollama.model });
  });

  it('flags a common first name as ambiguous and keeps a coined name clear', async () => {
    const triage = new OllamaAmbiguityTriage(client);

    await expect(triage.assess('Harvey')).resolves.toMatchObject({ ambiguous: true });
    await expect(triage.assess('ZutaCore')).resolves.toMatchObject({ ambiguous: false });
  });

  it('agrees with recorded relevance verdicts', async () => {
    const recording = await loadRecording(FIXTURES, 'relevance');
    const classifier = new OllamaRelevanceClassifier(client);

    for (const entry of recording.entries.slice(0, SAMPLE_SIZE)) {
      const verdict = await classifier.judge(entry.company, entry.article);
      expect({ title: entry.article.title, relevant: verdict.relevant }).toEqual({
        title: entry.article.title,
        relevant: entry.verdict.relevant,
      });
    }
  });

  it('agrees with recorded sentiment verdicts', async () => {
    const recording = await loadRecording(FIXTURES, 'sentiment');
    const classifier = new OllamaSentimentClassifier(client);

    for (const entry of recording.entries.slice(0, SAMPLE_SIZE)) {
      const verdict = await classifier.classify(entry.company, entry.article);
      expect({ title: entry.article.title, sentiment: verdict.sentiment }).toEqual({
        title: entry.article.title,
        sentiment: entry.verdict.sentiment,
      });
    }
  });
});
