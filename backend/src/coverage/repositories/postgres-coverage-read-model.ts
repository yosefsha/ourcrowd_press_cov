import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { TrackedCompany, TrackedCompanyStatus } from '../../domain/company';
import type { DateRange } from '../../domain/date-range';
import type { Relevance, RelevanceMethod } from '../../domain/relevance';
import type { Sentiment } from '../../domain/sentiment';
import {
  CoverageCompanyNotFound,
  CoverageDataUnavailable,
  type CandidateSelection,
  type CandidateSlice,
  type CollectionTimeline,
  type CompanyCoverage,
  type CompanyCoverageDetail,
  type CoverageArticle,
  type CoverageReadModel,
  type WeeklyMentionCount,
} from '../coverage-read-model';

/** Columns of an Article as selected under the given prefix. */
interface ArticleRow {
  readonly article_id: number | null;
  readonly title: string | null;
  readonly snippet: string | null;
  readonly outlet_name: string | null;
  readonly outlet_url: string | null;
  readonly google_url: string | null;
  readonly publisher_url: string | null;
  readonly published_at: Date | null;
  readonly language: string | null;
  readonly edition: string | null;
}

interface CoverageRow extends ArticleRow {
  readonly company_id: number;
  readonly display_name: string;
  readonly coverage_capped: boolean;
  readonly last_mention_at: Date | null;
  readonly mention_count: number;
  readonly positive: number;
  readonly negative: number;
  readonly neutral: number;
}

interface DetailRow extends CoverageRow {
  readonly source_name: string | null;
  readonly aliases: string[];
  readonly domain: string | null;
  readonly description: string | null;
  readonly search_terms: string[];
  readonly status: TrackedCompanyStatus;
  readonly review_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly relevant_candidates: number;
  readonly rejected_candidates: number;
}

interface WeekRow {
  readonly week_start: string;
  readonly positive: number;
  readonly negative: number;
  readonly neutral: number;
}

interface CandidateRow extends ArticleRow {
  readonly id: number;
  readonly relevance: Relevance;
  readonly relevance_method: RelevanceMethod | null;
  readonly relevance_reason: string | null;
  readonly sentiment: Sentiment | null;
  readonly sentiment_reason: string | null;
  readonly confirmed_at: Date | null;
  readonly total: number;
}

interface TimelineRow {
  readonly last_refreshed_at: Date | null;
  readonly first_candidate_fetched_at: Date | null;
  readonly first_backfill_started_at: Date | null;
}

const ARTICLE_COLUMNS = `
  a.id AS article_id, a.title, a.snippet, a.outlet_name, a.outlet_url, a.google_url,
  a.publisher_url, a.published_at, a.language, a.edition`;

/**
 * Per-company coverage for the period [$1, $2): the latest Mention ever, the
 * Mention counts in the period and the latest Mention in the period. Aggregated
 * in Postgres, one lateral subquery per measure, each served by the
 * (company_id, relevance) index. `%WHERE%` narrows the companies.
 */
const COVERAGE_SELECT = `
  SELECT tc.id AS company_id, tc.display_name, tc.coverage_capped,
         ever.last_mention_at,
         inside.mention_count, inside.positive, inside.negative, inside.neutral,
         latest.*
  FROM tracked_companies tc
  LEFT JOIN LATERAL (
    SELECT max(a.published_at) AS last_mention_at
    FROM candidates c JOIN articles a ON a.id = c.article_id
    WHERE c.company_id = tc.id AND c.relevance = 'relevant'
  ) ever ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS mention_count,
           (count(*) FILTER (WHERE c.sentiment = 'positive'))::int AS positive,
           (count(*) FILTER (WHERE c.sentiment = 'negative'))::int AS negative,
           (count(*) FILTER (WHERE c.sentiment = 'neutral'))::int AS neutral
    FROM candidates c JOIN articles a ON a.id = c.article_id
    WHERE c.company_id = tc.id AND c.relevance = 'relevant'
      AND a.published_at >= $1 AND a.published_at < $2
  ) inside ON true
  LEFT JOIN LATERAL (
    SELECT ${ARTICLE_COLUMNS}
    FROM candidates c JOIN articles a ON a.id = c.article_id
    WHERE c.company_id = tc.id AND c.relevance = 'relevant'
      AND a.published_at >= $1 AND a.published_at < $2
    ORDER BY a.published_at DESC, a.id DESC
    LIMIT 1
  ) latest ON true`;

const SELECTION_RELEVANCES: Readonly<Record<CandidateSelection, readonly Relevance[]>> = {
  mentions: ['relevant'],
  rejected: ['rejected'],
  all: ['pending', 'relevant', 'rejected'],
};

/** Escapes LIKE wildcards so a name search matches its text literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

function toArticle(row: ArticleRow): CoverageArticle | null {
  if (row.article_id === null || row.published_at === null) return null;
  return {
    id: row.article_id,
    title: row.title ?? '',
    snippet: row.snippet ?? '',
    outletName: row.outlet_name ?? '',
    outletUrl: row.outlet_url ?? '',
    googleUrl: row.google_url ?? '',
    publisherUrl: row.publisher_url,
    publishedAt: row.published_at,
    language: row.language ?? '',
    edition: row.edition ?? '',
  };
}

function toCoverage(row: CoverageRow): CompanyCoverage {
  return {
    companyId: row.company_id,
    displayName: row.display_name,
    capped: row.coverage_capped,
    lastMentionAt: row.last_mention_at,
    mentionCount: row.mention_count,
    sentiment: { positive: row.positive, negative: row.negative, neutral: row.neutral },
    latestMention: toArticle(row),
  };
}

function toCompany(row: DetailRow): TrackedCompany {
  return {
    id: row.company_id,
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

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

/** `CoverageReadModel` over the Postgres schema (ADR-005). */
@Injectable()
export class PostgresCoverageReadModel implements CoverageReadModel {
  constructor(private readonly dataSource: DataSource) {}

  async listActiveCompanyCoverage(
    period: DateRange,
    nameQuery: string | null,
  ): Promise<readonly CompanyCoverage[]> {
    const rows = await this.query<CoverageRow>(
      `${COVERAGE_SELECT}
       WHERE tc.status = 'active'
         AND ($3::text IS NULL
              OR tc.display_name ILIKE $3
              OR EXISTS (SELECT 1 FROM unnest(tc.aliases) alias WHERE alias ILIKE $3))
       ORDER BY tc.id`,
      [period.from, period.to, nameQuery === null ? null : likePattern(nameQuery)],
    );
    return rows.map(toCoverage);
  }

  async getCompanyCoverage(companyId: number, period: DateRange): Promise<CompanyCoverageDetail> {
    const [row] = await this.query<DetailRow>(
      `SELECT coverage.*, tc.source_name, tc.aliases, tc.domain, tc.description, tc.search_terms,
              tc.status, tc.review_reason, tc.created_at, tc.updated_at,
              verdicts.relevant_candidates, verdicts.rejected_candidates
       FROM (${COVERAGE_SELECT} WHERE tc.id = $3) coverage
       JOIN tracked_companies tc ON tc.id = coverage.company_id
       CROSS JOIN LATERAL (
         SELECT (count(*) FILTER (WHERE c.relevance = 'relevant'))::int AS relevant_candidates,
                (count(*) FILTER (WHERE c.relevance = 'rejected'))::int AS rejected_candidates
         FROM candidates c JOIN articles a ON a.id = c.article_id
         WHERE c.company_id = tc.id AND a.published_at >= $1 AND a.published_at < $2
       ) verdicts`,
      [period.from, period.to, companyId],
    );
    if (row === undefined) throw new CoverageCompanyNotFound(companyId);
    return {
      ...toCoverage(row),
      company: toCompany(row),
      relevantCandidates: row.relevant_candidates,
      rejectedCandidates: row.rejected_candidates,
    };
  }

  async weeklyMentionCounts(
    companyId: number,
    period: DateRange,
    timeZone: string,
  ): Promise<readonly WeeklyMentionCount[]> {
    const rows = await this.query<WeekRow>(
      `SELECT to_char(date_trunc('week', a.published_at AT TIME ZONE $4), 'YYYY-MM-DD') AS week_start,
              (count(*) FILTER (WHERE c.sentiment = 'positive'))::int AS positive,
              (count(*) FILTER (WHERE c.sentiment = 'negative'))::int AS negative,
              (count(*) FILTER (WHERE c.sentiment = 'neutral'))::int AS neutral
       FROM candidates c JOIN articles a ON a.id = c.article_id
       WHERE c.company_id = $3 AND c.relevance = 'relevant' AND c.sentiment IS NOT NULL
         AND a.published_at >= $1 AND a.published_at < $2
       GROUP BY 1
       ORDER BY 1`,
      [period.from, period.to, companyId, timeZone],
    );
    return rows.map((row) => ({
      weekStart: parseIsoDate(row.week_start),
      sentiment: { positive: row.positive, negative: row.negative, neutral: row.neutral },
    }));
  }

  async listCandidates(
    companyId: number,
    period: DateRange,
    selection: CandidateSelection,
    page: { readonly offset: number; readonly limit: number },
  ): Promise<CandidateSlice> {
    const [company] = await this.query<{ id: number }>(`SELECT id FROM tracked_companies WHERE id = $1`, [
      companyId,
    ]);
    if (company === undefined) throw new CoverageCompanyNotFound(companyId);

    const rows = await this.query<CandidateRow>(
      `SELECT c.id, c.relevance, c.relevance_method, c.relevance_reason, c.sentiment,
              c.sentiment_reason, c.confirmed_at, ${ARTICLE_COLUMNS},
              (count(*) OVER ())::int AS total
       FROM candidates c JOIN articles a ON a.id = c.article_id
       WHERE c.company_id = $1 AND c.relevance = ANY($2::candidate_relevance[])
         AND a.published_at >= $3 AND a.published_at < $4
       ORDER BY a.published_at DESC, c.id DESC
       OFFSET $5 LIMIT $6`,
      [companyId, SELECTION_RELEVANCES[selection], period.from, period.to, page.offset, page.limit],
    );
    const total =
      rows[0]?.total ?? (page.offset === 0 ? 0 : await this.countCandidates(companyId, period, selection));
    return {
      items: rows.flatMap((row) => {
        const article = toArticle(row);
        return article === null
          ? []
          : [
              {
                id: row.id,
                article,
                relevance: row.relevance,
                relevanceMethod: row.relevance_method,
                relevanceReason: row.relevance_reason,
                sentiment: row.sentiment,
                sentimentReason: row.sentiment_reason,
                confirmedAt: row.confirmed_at,
              },
            ];
      }),
      total,
    };
  }

  async collectionTimeline(): Promise<CollectionTimeline> {
    const [row] = await this.query<TimelineRow>(
      `SELECT
         (SELECT max(finished_at) FROM runs WHERE status IN ('completed', 'completed_with_errors'))
           AS last_refreshed_at,
         (SELECT min(created_at) FROM candidates) AS first_candidate_fetched_at,
         (SELECT min(started_at) FROM runs WHERE type = 'backfill') AS first_backfill_started_at`,
    );
    return {
      lastRefreshedAt: row?.last_refreshed_at ?? null,
      firstCandidateFetchedAt: row?.first_candidate_fetched_at ?? null,
      firstBackfillStartedAt: row?.first_backfill_started_at ?? null,
    };
  }

  /** A page past the end returns no rows, and so no window count: count separately. */
  private async countCandidates(
    companyId: number,
    period: DateRange,
    selection: CandidateSelection,
  ): Promise<number> {
    const [row] = await this.query<{ total: number }>(
      `SELECT count(*)::int AS total
       FROM candidates c JOIN articles a ON a.id = c.article_id
       WHERE c.company_id = $1 AND c.relevance = ANY($2::candidate_relevance[])
         AND a.published_at >= $3 AND a.published_at < $4`,
      [companyId, SELECTION_RELEVANCES[selection], period.from, period.to],
    );
    return row?.total ?? 0;
  }

  /** Runs one read; a driver failure becomes `CoverageDataUnavailable`. */
  private async query<T>(sql: string, parameters: readonly unknown[] = []): Promise<T[]> {
    try {
      return await this.dataSource.query<T[]>(sql, [...parameters]);
    } catch (cause) {
      throw new CoverageDataUnavailable('Could not read coverage data', { cause });
    }
  }
}
