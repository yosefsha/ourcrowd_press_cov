/**
 * Records real Ollama verdicts as test fixtures (ADR-006). Run from `backend/`
 * with Ollama up and `OLLAMA_MODEL` pulled:
 *
 *   npm run build
 *   node dist/classification/recorded/record-verdicts.cli.js \
 *     --articles <articles.json> [--out test/fixtures/ollama]
 *
 * `--articles` holds the real articles to judge (see `parseArticlesToRecord`);
 * the names triaged are the Seed List's display names (`SEED_LIST_PATH`).
 * Writes `relevance.json`, `sentiment.json` and `ambiguity.json` to `--out`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { configuration } from '../../config/configuration';
import { parseSeedList } from '../../domain/seed-line';
import { OllamaAmbiguityTriage } from '../ollama/ollama-ambiguity.triage';
import { OllamaClassifierHealth } from '../ollama/ollama-classifier-health';
import { OLLAMA_REQUEST_TIMEOUT_MS, OllamaClient } from '../ollama/ollama.client';
import { OllamaRelevanceClassifier } from '../ollama/ollama-relevance.classifier';
import { OllamaSentimentClassifier } from '../ollama/ollama-sentiment.classifier';
import { parseArticlesToRecord, recordVerdicts } from './record-verdicts';
import { recordingFileName, serializeRecording } from './recorded-verdicts';

const DEFAULT_OUT_DIR = 'test/fixtures/ollama';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      articles: { type: 'string' },
      out: { type: 'string', default: DEFAULT_OUT_DIR },
    },
  });
  if (values.articles === undefined) {
    throw new Error('Usage: record-verdicts.cli.js --articles <articles.json> [--out <dir>]');
  }

  const config = configuration();
  const client = new OllamaClient({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    numParallel: config.ollama.numParallel,
    timeoutMs: OLLAMA_REQUEST_TIMEOUT_MS,
  });
  const health = await new OllamaClassifierHealth(client).check();
  if (!health.ok) throw new Error(health.detail);

  const articlesPath = resolve(values.articles);
  const articles = parseArticlesToRecord(JSON.parse(await readFile(articlesPath, 'utf8')) as unknown, articlesPath);
  const names = parseSeedList(await readFile(config.seedList.path, 'utf8')).map((company) => company.displayName);

  const recordings = await recordVerdicts(
    articles,
    names,
    {
      relevance: new OllamaRelevanceClassifier(client),
      sentiment: new OllamaSentimentClassifier(client),
      triage: new OllamaAmbiguityTriage(client),
    },
    { model: client.model, recordedAt: new Date() },
  );

  const outDir = resolve(values.out);
  await mkdir(outDir, { recursive: true });
  for (const recording of [recordings.relevance, recordings.sentiment, recordings.ambiguity]) {
    const path = join(outDir, recordingFileName(recording.kind));
    await writeFile(path, serializeRecording<unknown>(recording), 'utf8');
    console.log(`Wrote ${recording.entries.length} ${recording.kind} verdicts to ${path}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
