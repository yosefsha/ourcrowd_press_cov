import { TRACKED_COMPANY_STATUSES } from '../domain/company';
import { RELEVANCE_METHODS, RELEVANCES } from '../domain/relevance';
import { RUN_STATUSES, RUN_TRIGGERS, RUN_TYPES, type RunParams, type RunProgress } from '../domain/run';
import { SENTIMENTS } from '../domain/sentiment';
import {
  EXPORT_SCHEMA_VERSION,
  countSnapshot,
  type AlertDigestRecord,
  type ArticleRecord,
  type CandidateRecord,
  type CompanyRecord,
  type ExportManifest,
  type RunCompanyErrorRecord,
  type RunRecord,
  type Snapshot,
  type SnapshotCounts,
} from './export-format';

/** The export's files are not a well-formed export of this format. */
export class InvalidExport extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidExport';
  }
}

/** The export was written in a format version this build cannot read. */
export class UnsupportedSchemaVersion extends Error {
  constructor(readonly found: unknown) {
    super(
      `The export has schemaVersion ${JSON.stringify(found)}; this build reads schemaVersion ${EXPORT_SCHEMA_VERSION} only.`,
    );
    this.name = 'UnsupportedSchemaVersion';
  }
}

type Json = Readonly<Record<string, unknown>>;

/** UTC instant with up to microsecond precision, as the exporter writes it. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads typed fields of one JSON object, naming the offending path on failure. */
class Fields {
  constructor(
    private readonly source: Json,
    private readonly path: string,
  ) {}

  static of(value: unknown, path: string): Fields {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new InvalidExport(`${path} must be an object`);
    }
    return new Fields(value as Json, path);
  }

  raw(key: string): unknown {
    if (!Object.hasOwn(this.source, key)) throw new InvalidExport(`${this.path}.${key} is missing`);
    return this.source[key];
  }

  private fail(key: string, expected: string): never {
    throw new InvalidExport(`${this.path}.${key} must be ${expected}`);
  }

  id(key: string): number {
    const value = this.raw(key);
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) this.fail(key, 'a positive integer');
    return value;
  }

  count(key: string): number {
    const value = this.raw(key);
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) this.fail(key, 'a non-negative integer');
    return value;
  }

  nullableId(key: string): number | null {
    return this.raw(key) === null ? null : this.id(key);
  }

  boolean(key: string): boolean {
    const value = this.raw(key);
    if (typeof value !== 'boolean') this.fail(key, 'a boolean');
    return value;
  }

  string(key: string): string {
    const value = this.raw(key);
    if (typeof value !== 'string') this.fail(key, 'a string');
    return value;
  }

  nullableString(key: string): string | null {
    return this.raw(key) === null ? null : this.string(key);
  }

  strings(key: string): string[] {
    const value = this.raw(key);
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      this.fail(key, 'an array of strings');
    }
    return value;
  }

  /** An absolute http(s) URL — what the collector stores; anything else (e.g. `javascript:`) is refused. */
  url(key: string): string {
    const value = this.string(key);
    let protocol: string;
    try {
      protocol = new URL(value).protocol;
    } catch {
      this.fail(key, 'an absolute URL');
    }
    if (protocol !== 'http:' && protocol !== 'https:') this.fail(key, 'an http(s) URL');
    return value;
  }

  nullableUrl(key: string): string | null {
    return this.raw(key) === null ? null : this.url(key);
  }

  timestamp(key: string): string {
    const value = this.raw(key);
    if (typeof value !== 'string' || !TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) {
      this.fail(key, 'a UTC timestamp');
    }
    return value;
  }

  nullableTimestamp(key: string): string | null {
    return this.raw(key) === null ? null : this.timestamp(key);
  }

  oneOf<T extends string>(key: string, allowed: readonly T[]): T {
    const value = this.raw(key);
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
      this.fail(key, `one of ${allowed.join(', ')}`);
    }
    return value as T;
  }

  nullableOneOf<T extends string>(key: string, allowed: readonly T[]): T | null {
    return this.raw(key) === null ? null : this.oneOf(key, allowed);
  }

  object(key: string): Fields {
    return Fields.of(this.raw(key), `${this.path}.${key}`);
  }

  list(key: string): unknown[] {
    const value = this.raw(key);
    if (!Array.isArray(value)) this.fail(key, 'an array');
    return value;
  }

  /** The object itself, for JSON columns kept verbatim once their known fields are checked. */
  get value(): Json {
    return this.source;
  }
}

function parseJson(text: string, fileName: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new InvalidExport(`${fileName} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseList<T>(text: string, fileName: string, parseItem: (item: Fields) => T): T[] {
  const value = parseJson(text, fileName);
  if (!Array.isArray(value)) throw new InvalidExport(`${fileName} must hold an array`);
  return value.map((item, index) => parseItem(Fields.of(item, `${fileName}[${index}]`)));
}

/**
 * The manifest of an export. The schema version is checked before anything
 * else, so an export from another format version is reported as such.
 */
export function parseManifest(text: string): ExportManifest {
  const fields = Fields.of(parseJson(text, 'manifest.json'), 'manifest.json');
  const schemaVersion = fields.value.schemaVersion;
  if (schemaVersion !== EXPORT_SCHEMA_VERSION) throw new UnsupportedSchemaVersion(schemaVersion);
  const counts = fields.object('counts');
  return {
    schemaVersion,
    exportedAt: fields.string('exportedAt'),
    timeZone: fields.string('timeZone'),
    counts: {
      companies: counts.count('companies'),
      articles: counts.count('articles'),
      candidates: counts.count('candidates'),
      mentions: counts.count('mentions'),
      runs: counts.count('runs'),
      runCompanyErrors: counts.count('runCompanyErrors'),
      alertDigests: counts.count('alertDigests'),
      alertDigestItems: counts.count('alertDigestItems'),
    },
  };
}

function parseCompany(item: Fields): CompanyRecord {
  const profile = item.object('profile');
  return {
    id: item.id('id'),
    sourceName: item.nullableString('sourceName'),
    status: item.oneOf('status', TRACKED_COMPANY_STATUSES),
    reviewReason: item.nullableString('reviewReason'),
    coverageCapped: item.boolean('coverageCapped'),
    profile: {
      displayName: profile.string('displayName'),
      aliases: profile.strings('aliases'),
      domain: profile.nullableString('domain'),
      description: profile.nullableString('description'),
      searchTerms: profile.strings('searchTerms'),
    },
    createdAt: item.timestamp('createdAt'),
    updatedAt: item.timestamp('updatedAt'),
  };
}

function parseArticle(item: Fields): ArticleRecord {
  return {
    id: item.id('id'),
    googleArticleId: item.string('googleArticleId'),
    title: item.string('title'),
    snippet: item.string('snippet'),
    outletName: item.string('outletName'),
    outletUrl: item.url('outletUrl'),
    googleUrl: item.url('googleUrl'),
    publisherUrl: item.nullableUrl('publisherUrl'),
    publishedAt: item.timestamp('publishedAt'),
    language: item.string('language'),
    edition: item.string('edition'),
    firstFetchedAt: item.timestamp('firstFetchedAt'),
  };
}

function parseCandidate(item: Fields): CandidateRecord {
  return {
    id: item.id('id'),
    articleId: item.id('articleId'),
    companyId: item.id('companyId'),
    fetchedInRunId: item.id('fetchedInRunId'),
    relevance: item.oneOf('relevance', RELEVANCES),
    relevanceMethod: item.nullableOneOf('relevanceMethod', RELEVANCE_METHODS),
    relevanceReason: item.nullableString('relevanceReason'),
    relevanceClassifiedAt: item.nullableTimestamp('relevanceClassifiedAt'),
    sentiment: item.nullableOneOf('sentiment', SENTIMENTS),
    sentimentReason: item.nullableString('sentimentReason'),
    sentimentClassifiedAt: item.nullableTimestamp('sentimentClassifiedAt'),
    confirmedInRunId: item.nullableId('confirmedInRunId'),
    confirmedAt: item.nullableTimestamp('confirmedAt'),
    createdAt: item.timestamp('createdAt'),
  };
}

/** Checks the fields the domain relies on; the object is kept verbatim, so nothing is lost. */
function parseRunParams(params: Fields): RunParams {
  const until = params.raw('until');
  if (until !== null && (typeof until !== 'string' || !ISO_DATE.test(until))) {
    throw new InvalidExport('params.until must be a YYYY-MM-DD date or null');
  }
  if (params.raw('companyIds') !== null) {
    const ids = params.list('companyIds');
    if (!ids.every((id) => typeof id === 'number' && Number.isSafeInteger(id))) {
      throw new InvalidExport('params.companyIds must be integers or null');
    }
  }
  params.boolean('reprocess');
  return params.value as unknown as RunParams;
}

function parseRunProgress(progress: Fields): RunProgress {
  for (const key of [
    'companiesTotal',
    'companiesDone',
    'candidatesFound',
    'candidatesClassified',
    'mentionsConfirmed',
    'companyErrors',
  ]) {
    progress.count(key);
  }
  progress.nullableString('currentCompany');
  return progress.value as unknown as RunProgress;
}

function parseRunCompanyError(item: Fields): RunCompanyErrorRecord {
  return {
    id: item.id('id'),
    companyId: item.id('companyId'),
    stage: item.string('stage'),
    message: item.string('message'),
    createdAt: item.timestamp('createdAt'),
  };
}

function parseRun(item: Fields): RunRecord {
  const progress = item.raw('progress');
  return {
    id: item.id('id'),
    type: item.oneOf('type', RUN_TYPES),
    status: item.oneOf('status', RUN_STATUSES),
    trigger: item.oneOf('trigger', RUN_TRIGGERS),
    params: parseRunParams(item.object('params')),
    progress: progress === null ? null : parseRunProgress(item.object('progress')),
    error: item.nullableString('error'),
    createdAt: item.timestamp('createdAt'),
    startedAt: item.nullableTimestamp('startedAt'),
    finishedAt: item.nullableTimestamp('finishedAt'),
    companyErrors: item
      .list('companyErrors')
      .map((error, index) => parseRunCompanyError(Fields.of(error, `runs.json[run ${String(item.raw('id'))}].companyErrors[${index}]`))),
  };
}

function parseAlertDigest(item: Fields): AlertDigestRecord {
  const candidateIds = item.list('candidateIds');
  if (!candidateIds.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)) {
    throw new InvalidExport(`alert-digests.json digest ${String(item.raw('id'))} has a candidate id that is not a positive integer`);
  }
  return {
    id: item.id('id'),
    runId: item.id('runId'),
    createdAt: item.timestamp('createdAt'),
    acknowledgedAt: item.nullableTimestamp('acknowledgedAt'),
    candidateIds: candidateIds as number[],
  };
}

function uniqueIds(fileName: string, ids: readonly number[]): ReadonlySet<number> {
  const set = new Set(ids);
  if (set.size !== ids.length) throw new InvalidExport(`${fileName} has duplicate ids`);
  return set;
}

function requireReference(set: ReadonlySet<number>, id: number | null, what: string): void {
  if (id !== null && !set.has(id)) throw new InvalidExport(`${what} refers to a record that is not in the export`);
}

/** Every reference inside the snapshot points at a record that is in it. */
function checkReferences(snapshot: Snapshot): void {
  const companies = uniqueIds('companies.json', snapshot.companies.map((company) => company.id));
  const articles = uniqueIds('articles.json', snapshot.articles.map((article) => article.id));
  const runs = uniqueIds('runs.json', snapshot.runs.map((run) => run.id));
  const candidates = uniqueIds('candidates.json', snapshot.candidates.map((candidate) => candidate.id));
  uniqueIds('runs.json company errors', snapshot.runs.flatMap((run) => run.companyErrors.map((error) => error.id)));
  uniqueIds('alert-digests.json', snapshot.alertDigests.map((digest) => digest.id));

  for (const run of snapshot.runs) {
    for (const error of run.companyErrors) {
      requireReference(companies, error.companyId, `runs.json run ${run.id} company error ${error.id}`);
    }
  }
  for (const candidate of snapshot.candidates) {
    const what = `candidates.json candidate ${candidate.id}`;
    requireReference(articles, candidate.articleId, what);
    requireReference(companies, candidate.companyId, what);
    requireReference(runs, candidate.fetchedInRunId, what);
    requireReference(runs, candidate.confirmedInRunId, what);
  }
  for (const digest of snapshot.alertDigests) {
    requireReference(runs, digest.runId, `alert-digests.json digest ${digest.id}`);
    if (new Set(digest.candidateIds).size !== digest.candidateIds.length) {
      throw new InvalidExport(`alert-digests.json digest ${digest.id} lists a candidate twice`);
    }
    for (const candidateId of digest.candidateIds) {
      requireReference(candidates, candidateId, `alert-digests.json digest ${digest.id}`);
    }
  }
}

function checkCounts(expected: SnapshotCounts, snapshot: Snapshot): void {
  const actual = countSnapshot(snapshot);
  const mismatched = (Object.keys(expected) as (keyof SnapshotCounts)[]).filter(
    (key) => expected[key] !== actual[key],
  );
  if (mismatched.length > 0) {
    throw new InvalidExport(
      `The files do not match manifest.json (${mismatched
        .map((key) => `${key}: manifest ${expected[key]}, files ${actual[key]}`)
        .join('; ')}); the export is incomplete or from different runs.`,
    );
  }
}

/** The raw text of the export's data files. */
export interface ExportFileTexts {
  readonly companies: string;
  readonly articles: string;
  readonly candidates: string;
  readonly runs: string;
  readonly alertDigests: string;
}

/**
 * A validated snapshot from the export's files: every field typed, every
 * reference resolvable and the row counts equal to the manifest's.
 * Throws `InvalidExport`.
 */
export function parseSnapshot(manifest: ExportManifest, files: ExportFileTexts): Snapshot {
  const snapshot: Snapshot = {
    companies: parseList(files.companies, 'companies.json', parseCompany),
    articles: parseList(files.articles, 'articles.json', parseArticle),
    candidates: parseList(files.candidates, 'candidates.json', parseCandidate),
    runs: parseList(files.runs, 'runs.json', parseRun),
    alertDigests: parseList(files.alertDigests, 'alert-digests.json', parseAlertDigest),
  };
  checkCounts(manifest.counts, snapshot);
  checkReferences(snapshot);
  return snapshot;
}
