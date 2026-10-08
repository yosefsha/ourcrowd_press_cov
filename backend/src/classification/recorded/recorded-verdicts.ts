import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { RelevanceVerdict } from '../../domain/relevance';
import type { SentimentVerdict } from '../../domain/sentiment';
import type { AmbiguityAssessment } from '../ambiguity-triage';
import { parseAmbiguityAssessment } from '../prompts/ambiguity.prompt';
import { isRecord } from '../prompts/prompt-parts';
import { parseRelevanceVerdict } from '../prompts/relevance.prompt';
import { parseSentimentVerdict } from '../prompts/sentiment.prompt';

/**
 * Real Ollama verdicts recorded by `record-verdicts` (ADR-006) and replayed by
 * the in-memory classifiers in tests. One JSON file per kind under
 * `test/fixtures/ollama/`; never written by hand.
 */

export const RECORDING_KINDS = ['relevance', 'sentiment', 'ambiguity'] as const;
export type RecordingKind = (typeof RECORDING_KINDS)[number];

export interface RecordedRelevance {
  readonly company: CompanyProfile;
  readonly article: ClassifiableArticle;
  readonly verdict: RelevanceVerdict;
}

export interface RecordedSentiment {
  readonly company: CompanyProfile;
  readonly article: ClassifiableArticle;
  readonly verdict: SentimentVerdict;
}

export interface RecordedAmbiguity {
  readonly name: string;
  readonly assessment: AmbiguityAssessment;
}

/** One recorded fixture file. */
export interface Recording<T> {
  readonly kind: RecordingKind;
  readonly model: string;
  readonly promptVersion: string;
  readonly recordedAt: Date;
  readonly entries: readonly T[];
}

export class InvalidRecording extends Error {
  constructor(source: string, problem: string) {
    super(`Invalid recorded verdicts in ${source}: ${problem}`);
    this.name = 'InvalidRecording';
  }
}

/** File name of a kind's recording inside the fixtures directory. */
export function recordingFileName(kind: RecordingKind): string {
  return `${kind}.json`;
}

/**
 * Identity of a (company, article) pair in a recording. Built from what the
 * classifier reads, so a replay matches exactly the question that was asked.
 */
export function articleVerdictKey(company: CompanyProfile, article: ClassifiableArticle): string {
  return JSON.stringify([
    company.displayName,
    article.title,
    article.outletName,
    article.publishedAt.toISOString(),
  ]);
}

/** Identity of a company name in an ambiguity recording. */
export function nameVerdictKey(name: string): string {
  return name.trim().toLowerCase();
}

type Reader<T> = (value: unknown) => T | undefined;

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readStringList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value) : undefined;
}

function readNullableString(value: unknown): string | null | undefined {
  return value === null ? null : readString(value);
}

function readDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function readCompany(value: unknown): CompanyProfile | undefined {
  if (!isRecord(value)) return undefined;
  const displayName = readString(value.displayName);
  const aliases = readStringList(value.aliases);
  const domain = readNullableString(value.domain);
  const description = readNullableString(value.description);
  const searchTerms = readStringList(value.searchTerms);
  if (
    displayName === undefined ||
    aliases === undefined ||
    domain === undefined ||
    description === undefined ||
    searchTerms === undefined
  ) {
    return undefined;
  }
  return { displayName, aliases, domain, description, searchTerms };
}

export function readArticle(value: unknown): ClassifiableArticle | undefined {
  if (!isRecord(value)) return undefined;
  const title = readString(value.title);
  const snippet = readString(value.snippet);
  const outletName = readString(value.outletName);
  const publishedAt = readDate(value.publishedAt);
  const language = readString(value.language);
  if (
    title === undefined ||
    snippet === undefined ||
    outletName === undefined ||
    publishedAt === undefined ||
    language === undefined
  ) {
    return undefined;
  }
  return { title, snippet, outletName, publishedAt, language };
}

function articleEntryReader<V>(readVerdict: Reader<V>): Reader<{ company: CompanyProfile; article: ClassifiableArticle; verdict: V }> {
  return (value) => {
    if (!isRecord(value)) return undefined;
    const company = readCompany(value.company);
    const article = readArticle(value.article);
    const verdict = readVerdict(value.verdict);
    return company && article && verdict !== undefined ? { company, article, verdict } : undefined;
  };
}

const ENTRY_READERS = {
  relevance: articleEntryReader(parseRelevanceVerdict),
  sentiment: articleEntryReader(parseSentimentVerdict),
  ambiguity: (value: unknown): RecordedAmbiguity | undefined => {
    if (!isRecord(value)) return undefined;
    const name = readString(value.name);
    const assessment = parseAmbiguityAssessment(value.assessment);
    return name !== undefined && assessment !== undefined ? { name, assessment } : undefined;
  },
} satisfies Record<RecordingKind, Reader<unknown>>;

interface EntryByKind {
  relevance: RecordedRelevance;
  sentiment: RecordedSentiment;
  ambiguity: RecordedAmbiguity;
}

/** Validates parsed recording JSON of `kind`; throws `InvalidRecording` naming the problem. */
export function parseRecording<K extends RecordingKind>(kind: K, json: unknown, source: string): Recording<EntryByKind[K]> {
  if (!isRecord(json)) throw new InvalidRecording(source, 'not a JSON object');
  if (json.kind !== kind) throw new InvalidRecording(source, `expected kind "${kind}", found ${JSON.stringify(json.kind)}`);
  const model = readString(json.model);
  const promptVersion = readString(json.promptVersion);
  const recordedAt = readDate(json.recordedAt);
  if (!model || !promptVersion || !recordedAt) {
    throw new InvalidRecording(source, 'model, promptVersion and recordedAt are required');
  }
  if (!Array.isArray(json.entries)) throw new InvalidRecording(source, 'entries must be an array');
  const readEntry = ENTRY_READERS[kind] as Reader<EntryByKind[K]>;
  const entries = json.entries.map((entry: unknown, index: number) => {
    const parsed = readEntry(entry);
    if (parsed === undefined) throw new InvalidRecording(source, `entry ${index} is malformed`);
    return parsed;
  });
  return { kind, model, promptVersion, recordedAt, entries };
}

/** JSON form of a recording, as written to its fixture file. */
export function serializeRecording<T>(recording: Recording<T>): string {
  return `${JSON.stringify({ ...recording, recordedAt: recording.recordedAt.toISOString() }, null, 2)}\n`;
}

/** Reads and validates one kind's recording from `directory`. */
export async function loadRecording<K extends RecordingKind>(directory: string, kind: K): Promise<Recording<EntryByKind[K]>> {
  const path = join(directory, recordingFileName(kind));
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new InvalidRecording(path, `cannot be read (${error instanceof Error ? error.message : String(error)}); record it with record-verdicts`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvalidRecording(path, 'not valid JSON');
  }
  return parseRecording(kind, json, path);
}
