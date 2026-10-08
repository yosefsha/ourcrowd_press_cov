import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError, type QueryRunner } from 'typeorm';

import type { TrackedCompanyStatus } from '../../domain/company';
import type { Relevance, RelevanceMethod } from '../../domain/relevance';
import type { RunParams, RunProgress, RunStatus, RunTrigger, RunType } from '../../domain/run';
import type { Sentiment } from '../../domain/sentiment';
import type {
  AlertDigestRecord,
  ArticleRecord,
  CandidateRecord,
  CompanyRecord,
  RunCompanyErrorRecord,
  RunRecord,
  Snapshot,
} from '../export-format';
import {
  SnapshotRejected,
  SnapshotStoreUnavailable,
  StoreNotEmpty,
  type SnapshotLoader,
  type SnapshotReader,
} from '../snapshot-store';

/**
 * The tables a snapshot covers, in foreign-key order. `collector_heartbeat` is
 * live process state (a running collector rewrites it every few seconds), not
 * data, so it is neither exported nor required to be empty.
 */
const SNAPSHOT_TABLES = [
  'tracked_companies',
  'articles',
  'runs',
  'run_company_errors',
  'candidates',
  'alert_digests',
  'alert_digest_items',
] as const;

/** Tables with an identity `id` whose sequence must move past the imported ids. */
const IDENTITY_TABLES = [
  'tracked_companies',
  'articles',
  'runs',
  'run_company_errors',
  'candidates',
  'alert_digests',
] as const;

/** Bind parameters per statement stay well under Postgres' limit of 65 535. */
const MAX_PARAMETERS = 30_000;

/** A timestamptz as UTC text with all six fractional digits — a `Date` would drop microseconds. */
function ts(column: string): string {
  return `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

interface CompanyRow {
  id: number;
  source_name: string | null;
  display_name: string;
  aliases: string[];
  domain: string | null;
  description: string | null;
  search_terms: string[];
  status: TrackedCompanyStatus;
  review_reason: string | null;
  coverage_capped: boolean;
  created_at: string;
  updated_at: string;
}

interface ArticleRow {
  id: number;
  google_article_id: string;
  title: string;
  snippet: string;
  outlet_name: string;
  outlet_url: string;
  google_url: string;
  publisher_url: string | null;
  published_at: string;
  language: string;
  edition: string;
  first_fetched_at: string;
}

interface CandidateRow {
  id: number;
  article_id: number;
  company_id: number;
  fetched_in_run_id: number;
  relevance: Relevance;
  relevance_method: RelevanceMethod | null;
  relevance_reason: string | null;
  relevance_classified_at: string | null;
  sentiment: Sentiment | null;
  sentiment_reason: string | null;
  sentiment_classified_at: string | null;
  confirmed_in_run_id: number | null;
  confirmed_at: string | null;
  created_at: string;
}

interface RunRow {
  id: number;
  type: RunType;
  status: RunStatus;
  trigger: RunTrigger;
  params: RunParams;
  progress: RunProgress | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface RunCompanyErrorRow {
  id: number;
  run_id: number;
  company_id: number;
  stage: string;
  message: string;
  created_at: string;
}

interface AlertDigestRow {
  id: number;
  run_id: number;
  created_at: string;
  acknowledged_at: string | null;
}

interface AlertDigestItemRow {
  digest_id: number;
  candidate_id: number;
}

/** A column of a bulk insert and the Postgres type its parameter is cast to. */
interface InsertColumn {
  readonly name: string;
  readonly type: string;
}

/**
 * The snapshot in Postgres: read inside one repeatable-read transaction (a
 * consistent picture even while the collector writes), loaded inside one
 * transaction that first locks every table and checks it is empty.
 */
@Injectable()
export class PostgresSnapshotStore implements SnapshotReader, SnapshotLoader {
  constructor(private readonly dataSource: DataSource) {}

  async readSnapshot(): Promise<Snapshot> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.query('START TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try {
        return await this.readAll(runner);
      } finally {
        await runner.query('COMMIT');
      }
    } catch (error) {
      throw new SnapshotStoreUnavailable('Cannot read the snapshot from Postgres', { cause: error });
    } finally {
      await runner.release();
    }
  }

  async loadIntoEmptyStore(snapshot: Snapshot): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(
          `LOCK TABLE ${SNAPSHOT_TABLES.map((table) => `"${table}"`).join(', ')} IN ACCESS EXCLUSIVE MODE`,
        );
        const nonEmpty = await this.nonEmptyTables(runner);
        if (nonEmpty.length > 0) throw new StoreNotEmpty(nonEmpty);
        await this.insertAll(runner, snapshot);
        await this.resetIdentitySequences(runner);
        await runner.commitTransaction();
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      if (error instanceof StoreNotEmpty) throw error;
      if (error instanceof QueryFailedError) {
        throw new SnapshotRejected(`Postgres rejected the snapshot: ${error.message}`, { cause: error });
      }
      throw new SnapshotStoreUnavailable('Cannot load the snapshot into Postgres', { cause: error });
    } finally {
      await runner.release();
    }
  }

  private async readAll(runner: QueryRunner): Promise<Snapshot> {
    const companies = (await runner.query(
      `SELECT id, source_name, display_name, aliases, domain, description, search_terms, status::text AS status,
              review_reason, coverage_capped, ${ts('created_at')} AS created_at, ${ts('updated_at')} AS updated_at
       FROM tracked_companies ORDER BY id`,
    )) as CompanyRow[];
    const articles = (await runner.query(
      `SELECT id, google_article_id, title, snippet, outlet_name, outlet_url, google_url, publisher_url,
              ${ts('published_at')} AS published_at, language, edition, ${ts('first_fetched_at')} AS first_fetched_at
       FROM articles ORDER BY id`,
    )) as ArticleRow[];
    const candidates = (await runner.query(
      `SELECT id, article_id, company_id, fetched_in_run_id, relevance::text AS relevance,
              relevance_method::text AS relevance_method, relevance_reason,
              ${ts('relevance_classified_at')} AS relevance_classified_at, sentiment::text AS sentiment,
              sentiment_reason, ${ts('sentiment_classified_at')} AS sentiment_classified_at, confirmed_in_run_id,
              ${ts('confirmed_at')} AS confirmed_at, ${ts('created_at')} AS created_at
       FROM candidates ORDER BY id`,
    )) as CandidateRow[];
    const runs = (await runner.query(
      `SELECT id, type::text AS type, status::text AS status, trigger::text AS trigger, params, progress, error,
              ${ts('created_at')} AS created_at, ${ts('started_at')} AS started_at, ${ts('finished_at')} AS finished_at
       FROM runs ORDER BY id`,
    )) as RunRow[];
    const runErrors = (await runner.query(
      `SELECT id, run_id, company_id, stage, message, ${ts('created_at')} AS created_at
       FROM run_company_errors ORDER BY id`,
    )) as RunCompanyErrorRow[];
    const digests = (await runner.query(
      `SELECT id, run_id, ${ts('created_at')} AS created_at, ${ts('acknowledged_at')} AS acknowledged_at
       FROM alert_digests ORDER BY id`,
    )) as AlertDigestRow[];
    const digestItems = (await runner.query(
      `SELECT digest_id, candidate_id FROM alert_digest_items ORDER BY digest_id, candidate_id`,
    )) as AlertDigestItemRow[];

    const errorsByRun = groupBy(runErrors, (error) => error.run_id);
    const itemsByDigest = groupBy(digestItems, (item) => item.digest_id);
    return {
      companies: companies.map(toCompanyRecord),
      articles: articles.map(toArticleRecord),
      candidates: candidates.map(toCandidateRecord),
      runs: runs.map((run) => toRunRecord(run, errorsByRun.get(run.id) ?? [])),
      alertDigests: digests.map(
        (digest): AlertDigestRecord => ({
          id: digest.id,
          runId: digest.run_id,
          createdAt: digest.created_at,
          acknowledgedAt: digest.acknowledged_at,
          candidateIds: (itemsByDigest.get(digest.id) ?? []).map((item) => item.candidate_id),
        }),
      ),
    };
  }

  private async nonEmptyTables(runner: QueryRunner): Promise<string[]> {
    const rows = (await runner.query(
      SNAPSHOT_TABLES.map(
        (table) => `SELECT '${table}' AS name WHERE EXISTS (SELECT 1 FROM "${table}")`,
      ).join(' UNION ALL '),
    )) as { name: string }[];
    const found = new Set(rows.map((row) => row.name));
    return SNAPSHOT_TABLES.filter((table) => found.has(table));
  }

  private async insertAll(runner: QueryRunner, snapshot: Snapshot): Promise<void> {
    await insertRows(
      runner,
      'tracked_companies',
      [
        { name: 'id', type: 'integer' },
        { name: 'source_name', type: 'text' },
        { name: 'display_name', type: 'text' },
        { name: 'aliases', type: 'text[]' },
        { name: 'domain', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'search_terms', type: 'text[]' },
        { name: 'status', type: 'tracked_company_status' },
        { name: 'review_reason', type: 'text' },
        { name: 'coverage_capped', type: 'boolean' },
        { name: 'created_at', type: 'timestamptz' },
        { name: 'updated_at', type: 'timestamptz' },
      ],
      snapshot.companies.map((company) => [
        company.id,
        company.sourceName,
        company.profile.displayName,
        [...company.profile.aliases],
        company.profile.domain,
        company.profile.description,
        [...company.profile.searchTerms],
        company.status,
        company.reviewReason,
        company.coverageCapped,
        company.createdAt,
        company.updatedAt,
      ]),
    );
    await insertRows(
      runner,
      'articles',
      [
        { name: 'id', type: 'integer' },
        { name: 'google_article_id', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'snippet', type: 'text' },
        { name: 'outlet_name', type: 'text' },
        { name: 'outlet_url', type: 'text' },
        { name: 'google_url', type: 'text' },
        { name: 'publisher_url', type: 'text' },
        { name: 'published_at', type: 'timestamptz' },
        { name: 'language', type: 'text' },
        { name: 'edition', type: 'text' },
        { name: 'first_fetched_at', type: 'timestamptz' },
      ],
      snapshot.articles.map((article) => [
        article.id,
        article.googleArticleId,
        article.title,
        article.snippet,
        article.outletName,
        article.outletUrl,
        article.googleUrl,
        article.publisherUrl,
        article.publishedAt,
        article.language,
        article.edition,
        article.firstFetchedAt,
      ]),
    );
    await insertRows(
      runner,
      'runs',
      [
        { name: 'id', type: 'integer' },
        { name: 'type', type: 'run_type' },
        { name: 'status', type: 'run_status' },
        { name: 'params', type: 'jsonb' },
        { name: 'trigger', type: 'run_trigger' },
        { name: 'progress', type: 'jsonb' },
        { name: 'error', type: 'text' },
        { name: 'created_at', type: 'timestamptz' },
        { name: 'started_at', type: 'timestamptz' },
        { name: 'finished_at', type: 'timestamptz' },
      ],
      snapshot.runs.map((run) => [
        run.id,
        run.type,
        run.status,
        JSON.stringify(run.params),
        run.trigger,
        run.progress === null ? null : JSON.stringify(run.progress),
        run.error,
        run.createdAt,
        run.startedAt,
        run.finishedAt,
      ]),
    );
    await insertRows(
      runner,
      'run_company_errors',
      [
        { name: 'id', type: 'integer' },
        { name: 'run_id', type: 'integer' },
        { name: 'company_id', type: 'integer' },
        { name: 'stage', type: 'text' },
        { name: 'message', type: 'text' },
        { name: 'created_at', type: 'timestamptz' },
      ],
      snapshot.runs.flatMap((run) =>
        run.companyErrors.map((error) => [
          error.id,
          run.id,
          error.companyId,
          error.stage,
          error.message,
          error.createdAt,
        ]),
      ),
    );
    await insertRows(
      runner,
      'candidates',
      [
        { name: 'id', type: 'integer' },
        { name: 'article_id', type: 'integer' },
        { name: 'company_id', type: 'integer' },
        { name: 'fetched_in_run_id', type: 'integer' },
        { name: 'relevance', type: 'candidate_relevance' },
        { name: 'relevance_method', type: 'relevance_method' },
        { name: 'relevance_reason', type: 'text' },
        { name: 'relevance_classified_at', type: 'timestamptz' },
        { name: 'sentiment', type: 'sentiment' },
        { name: 'sentiment_reason', type: 'text' },
        { name: 'sentiment_classified_at', type: 'timestamptz' },
        { name: 'confirmed_in_run_id', type: 'integer' },
        { name: 'confirmed_at', type: 'timestamptz' },
        { name: 'created_at', type: 'timestamptz' },
      ],
      snapshot.candidates.map((candidate) => [
        candidate.id,
        candidate.articleId,
        candidate.companyId,
        candidate.fetchedInRunId,
        candidate.relevance,
        candidate.relevanceMethod,
        candidate.relevanceReason,
        candidate.relevanceClassifiedAt,
        candidate.sentiment,
        candidate.sentimentReason,
        candidate.sentimentClassifiedAt,
        candidate.confirmedInRunId,
        candidate.confirmedAt,
        candidate.createdAt,
      ]),
    );
    await insertRows(
      runner,
      'alert_digests',
      [
        { name: 'id', type: 'integer' },
        { name: 'run_id', type: 'integer' },
        { name: 'created_at', type: 'timestamptz' },
        { name: 'acknowledged_at', type: 'timestamptz' },
      ],
      snapshot.alertDigests.map((digest) => [digest.id, digest.runId, digest.createdAt, digest.acknowledgedAt]),
    );
    await insertRows(
      runner,
      'alert_digest_items',
      [
        { name: 'digest_id', type: 'integer' },
        { name: 'candidate_id', type: 'integer' },
      ],
      snapshot.alertDigests.flatMap((digest) => digest.candidateIds.map((candidateId) => [digest.id, candidateId])),
    );
  }

  /** Moves each identity past the imported ids, so the next insert does not collide. */
  private async resetIdentitySequences(runner: QueryRunner): Promise<void> {
    for (const table of IDENTITY_TABLES) {
      await runner.query(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${table}"`,
      );
    }
  }
}

/** Multi-row INSERTs with explicit ids, chunked to stay under the bind-parameter limit. */
async function insertRows(
  runner: QueryRunner,
  table: (typeof SNAPSHOT_TABLES)[number],
  columns: readonly InsertColumn[],
  rows: readonly (readonly unknown[])[],
): Promise<void> {
  const perStatement = Math.max(1, Math.floor(MAX_PARAMETERS / columns.length));
  const columnList = columns.map((column) => `"${column.name}"`).join(', ');
  for (let start = 0; start < rows.length; start += perStatement) {
    const chunk = rows.slice(start, start + perStatement);
    const values = chunk
      .map(
        (_row, rowIndex) =>
          `(${columns
            .map((column, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}::${column.type}`)
            .join(', ')})`,
      )
      .join(', ');
    await runner.query(`INSERT INTO "${table}" (${columnList}) VALUES ${values}`, chunk.flat());
  }
}

function groupBy<T>(rows: readonly T[], key: (row: T) => number): ReadonlyMap<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group === undefined) groups.set(key(row), [row]);
    else group.push(row);
  }
  return groups;
}

function toCompanyRecord(row: CompanyRow): CompanyRecord {
  return {
    id: row.id,
    sourceName: row.source_name,
    status: row.status,
    reviewReason: row.review_reason,
    coverageCapped: row.coverage_capped,
    profile: {
      displayName: row.display_name,
      aliases: row.aliases,
      domain: row.domain,
      description: row.description,
      searchTerms: row.search_terms,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toArticleRecord(row: ArticleRow): ArticleRecord {
  return {
    id: row.id,
    googleArticleId: row.google_article_id,
    title: row.title,
    snippet: row.snippet,
    outletName: row.outlet_name,
    outletUrl: row.outlet_url,
    googleUrl: row.google_url,
    publisherUrl: row.publisher_url,
    publishedAt: row.published_at,
    language: row.language,
    edition: row.edition,
    firstFetchedAt: row.first_fetched_at,
  };
}

function toCandidateRecord(row: CandidateRow): CandidateRecord {
  return {
    id: row.id,
    articleId: row.article_id,
    companyId: row.company_id,
    fetchedInRunId: row.fetched_in_run_id,
    relevance: row.relevance,
    relevanceMethod: row.relevance_method,
    relevanceReason: row.relevance_reason,
    relevanceClassifiedAt: row.relevance_classified_at,
    sentiment: row.sentiment,
    sentimentReason: row.sentiment_reason,
    sentimentClassifiedAt: row.sentiment_classified_at,
    confirmedInRunId: row.confirmed_in_run_id,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}

function toRunRecord(row: RunRow, errors: readonly RunCompanyErrorRow[]): RunRecord {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    trigger: row.trigger,
    params: row.params,
    progress: row.progress,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    companyErrors: errors.map(
      (error): RunCompanyErrorRecord => ({
        id: error.id,
        companyId: error.company_id,
        stage: error.stage,
        message: error.message,
        createdAt: error.created_at,
      }),
    ),
  };
}
