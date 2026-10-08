/**
 * `npm run eval:classifiers` (#18): runs the real Ollama classifiers over the
 * validation set, scores them against the human labels once there are any, and
 * writes `docs/validation-report.md` (model, prompt versions, date, latency,
 * Backfill estimate). Run from `backend/` with Ollama up and `OLLAMA_MODEL`
 * pulled. Flags: `--labels <sheet.md|sheet.csv>`, `--set`, `--volume`, `--report`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, totalmem } from 'node:os';
import { extname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';

import { configuration } from '../../config/configuration';
import { parseSeedList } from '../../domain/seed-line';
import { GOOGLE_NEWS_MIN_REQUEST_INTERVAL_MS } from '../../news/news.module';
import { OllamaClassifierHealth } from '../ollama/ollama-classifier-health';
import { OLLAMA_REQUEST_TIMEOUT_MS, OllamaClient } from '../ollama/ollama.client';
import { OllamaRelevanceClassifier } from '../ollama/ollama-relevance.classifier';
import { OllamaSentimentClassifier } from '../ollama/ollama-sentiment.classifier';
import { RELEVANCE_PROMPT_VERSION } from '../prompts/relevance.prompt';
import { SENTIMENT_PROMPT_VERSION } from '../prompts/sentiment.prompt';
import { estimateBackfill } from './backfill-estimate';
import { parseCandidateVolume, summarizeVolume } from './candidate-volume';
import { classifyValidationSet, latencyFigures, scoreAgainstLabels } from './evaluate';
import { InvalidLabellingSheet, parseLabellingSheetCsv, parseLabellingSheetMarkdown, type SheetLabels } from './labelling-sheet';
import { renderValidationReport, type ReportInput } from './validation-report';
import { parseValidationSet, type ValidationSet } from './validation-set';
import { VALIDATION_PATHS } from './validation-paths';

/** Classification is measured one request at a time, as the pipeline sends them. */
const SEQUENTIAL = 1;

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function readLabels(path: string, set: ValidationSet): Promise<SheetLabels> {
  const text = await readFile(path, 'utf8');
  const sheet = extname(path).toLowerCase() === '.csv' ? parseLabellingSheetCsv(text, path) : parseLabellingSheetMarkdown(text, path);
  const ids = new Set(set.items.map((item) => item.id));
  const unknown = [...sheet.labels.map((label) => label.id), ...sheet.unlabelled].filter((id) => !ids.has(id));
  if (unknown.length > 0) {
    throw new InvalidLabellingSheet(path, unknown.map((id) => `${id}: not an item of the validation set`));
  }
  return sheet;
}

function describeMachine(): string {
  const [cpu] = cpus();
  return `${platform()} ${arch()}, ${cpu?.model.trim() ?? 'unknown CPU'}, ${Math.round(totalmem() / 2 ** 30)} GB RAM`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      set: { type: 'string', default: VALIDATION_PATHS.set },
      labels: { type: 'string', default: VALIDATION_PATHS.sheetMarkdown },
      volume: { type: 'string', default: VALIDATION_PATHS.volume },
      report: { type: 'string', default: VALIDATION_PATHS.report },
    },
  });
  const setPath = resolve(values.set);
  const labelsPath = resolve(values.labels);
  const reportPath = resolve(values.report);
  const set = parseValidationSet(await readJson(setPath), setPath);
  const sheet = await readLabels(labelsPath, set);

  const config = configuration();
  const client = new OllamaClient({
    baseUrl: config.ollama.baseUrl,
    model: config.ollama.model,
    numParallel: SEQUENTIAL,
    timeoutMs: OLLAMA_REQUEST_TIMEOUT_MS,
  });
  const health = await new OllamaClassifierHealth(client).check();
  if (!health.ok) throw new Error(health.detail);

  console.log(`Classifying ${set.items.length} items with ${client.model} (${sheet.labels.length} labelled)…`);
  const run = await classifyValidationSet(
    set.items,
    { relevance: new OllamaRelevanceClassifier(client), sentiment: new OllamaSentimentClassifier(client) },
    () => performance.now(),
    (done, total) => {
      if (done % 10 === 0 || done === total) console.log(`  ${done}/${total}`);
    },
  );
  const latency = latencyFigures(run);

  const volumePath = resolve(values.volume);
  const volumeSample = parseCandidateVolume(await readJson(volumePath), volumePath);
  const volume = summarizeVolume(volumeSample);
  const companies = parseSeedList(await readFile(config.seedList.path, 'utf8')).length;
  let backfill: ReportInput['backfill'] = null;
  if (latency.relevance !== null && latency.sentiment !== null && latency.relevantShare !== null) {
    const input = {
      companies,
      editions: config.news.editions.length,
      foundPerCompany: Object.values(volume.meanFoundPerEdition).reduce((sum, found) => sum + found, 0),
      classifiedPerCompany: volume.meanClassifiedPerCompany,
      relevantShare: latency.relevantShare,
      relevance: latency.relevance,
      sentiment: latency.sentiment,
      newsRequestIntervalMs: GOOGLE_NEWS_MIN_REQUEST_INTERVAL_MS,
    };
    backfill = {
      volume,
      volumeRecordedAt: volumeSample.recordedAt,
      sampleRule: volumeSample.sampleRule,
      input,
      estimate: estimateBackfill(input),
    };
  }

  const repositoryRoot = resolve('..');
  const report = renderValidationReport({
    ranAt: new Date(),
    model: client.model,
    promptVersions: { relevance: RELEVANCE_PROMPT_VERSION, sentiment: SENTIMENT_PROMPT_VERSION },
    machine: describeMachine(),
    items: set.items,
    labelsPath: relative(repositoryRoot, labelsPath),
    quality: sheet.labels.length > 0 ? scoreAgainstLabels(set.items, run, sheet.labels) : null,
    unlabelled: sheet.unlabelled.length,
    warmUpMs: run.warmUpMs,
    latency,
    backfill,
  });
  await writeFile(reportPath, report, 'utf8');
  console.log(
    `relevance median ${latency.relevance?.medianMs.toFixed(0)} ms, p95 ${latency.relevance?.p95Ms.toFixed(0)} ms; ` +
      `sentiment median ${latency.sentiment?.medianMs.toFixed(0)} ms, p95 ${latency.sentiment?.p95Ms.toFixed(0)} ms`,
  );
  console.log(`Wrote ${reportPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
