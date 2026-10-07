import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { Sentiment } from '../../domain/sentiment';
import {
  AlertDigestNotFound,
  type AlertDigestFilter,
  type AlertDigestRepository,
  type StoredAlertDigest,
  type StoredAlertDigestSummary,
  type StoredAlertMention,
} from '../alert-digest.repository';

/** `alert_digests.id` is a Postgres `integer`; a larger id cannot exist. */
const MAX_DIGEST_ID = 2_147_483_647;

interface SummaryRow {
  readonly id: number;
  readonly run_id: number;
  readonly created_at: Date;
  readonly acknowledged_at: Date | null;
  readonly mention_count: number;
  readonly company_count: number;
  readonly negative_mention_count: number;
}

interface MentionRow {
  readonly candidate_id: number;
  readonly company_id: number;
  readonly display_name: string;
  readonly sentiment: Sentiment;
  readonly article_id: number;
  readonly title: string;
  readonly snippet: string;
  readonly outlet_name: string;
  readonly outlet_url: string;
  readonly google_url: string;
  readonly publisher_url: string | null;
  readonly published_at: Date;
  readonly language: string;
  readonly edition: string;
}

/**
 * A digest item counts while its Candidate is still a judged Mention.
 * Re-processing a company deletes its Candidates, and their items with them.
 */
const LISTED_MENTION = `c.id = i.candidate_id AND c.relevance = 'relevant' AND c.sentiment IS NOT NULL`;

const SUMMARY_SELECT = `
  SELECT d.id, d.run_id, d.created_at, d.acknowledged_at,
         count(c.id)::int AS mention_count,
         count(DISTINCT c.company_id)::int AS company_count,
         (count(c.id) FILTER (WHERE c.sentiment = 'negative'))::int AS negative_mention_count
    FROM alert_digests d
    LEFT JOIN alert_digest_items i ON i.digest_id = d.id
    LEFT JOIN candidates c ON ${LISTED_MENTION}`;

/** Alert Digests read from and acknowledged in Postgres. */
@Injectable()
export class PostgresAlertDigestRepository implements AlertDigestRepository {
  constructor(private readonly dataSource: DataSource) {}

  async list(filter: AlertDigestFilter): Promise<readonly StoredAlertDigestSummary[]> {
    const rows = await this.dataSource.query<SummaryRow[]>(
      `${SUMMARY_SELECT}
        WHERE $1::boolean IS NULL OR (d.acknowledged_at IS NOT NULL) = $1::boolean
        GROUP BY d.id
        ORDER BY d.created_at DESC, d.id DESC`,
      [filter.acknowledged ?? null],
    );
    return rows.map(toSummary);
  }

  async get(id: number): Promise<StoredAlertDigest> {
    const summary = await this.findSummary(id);
    const rows = await this.dataSource.query<MentionRow[]>(
      `SELECT c.id AS candidate_id, c.company_id, tc.display_name, c.sentiment,
              a.id AS article_id, a.title, a.snippet, a.outlet_name, a.outlet_url, a.google_url,
              a.publisher_url, a.published_at, a.language, a.edition
         FROM alert_digest_items i
         JOIN candidates c ON ${LISTED_MENTION}
         JOIN articles a ON a.id = c.article_id
         JOIN tracked_companies tc ON tc.id = c.company_id
        WHERE i.digest_id = $1`,
      [id],
    );
    return { summary, mentions: rows.map(toMention) };
  }

  async acknowledge(id: number, at: Date): Promise<StoredAlertDigestSummary> {
    if (isStorableId(id)) {
      await this.dataSource.query(
        `UPDATE alert_digests SET acknowledged_at = $2 WHERE id = $1 AND acknowledged_at IS NULL`,
        [id, at],
      );
    }
    return this.findSummary(id);
  }

  private async findSummary(id: number): Promise<StoredAlertDigestSummary> {
    if (!isStorableId(id)) throw new AlertDigestNotFound(id);
    const [row] = await this.dataSource.query<SummaryRow[]>(`${SUMMARY_SELECT} WHERE d.id = $1 GROUP BY d.id`, [id]);
    if (row === undefined) throw new AlertDigestNotFound(id);
    return toSummary(row);
  }
}

function isStorableId(id: number): boolean {
  return Number.isSafeInteger(id) && id >= 1 && id <= MAX_DIGEST_ID;
}

function toSummary(row: SummaryRow): StoredAlertDigestSummary {
  return {
    id: row.id,
    runId: row.run_id,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    mentionCount: row.mention_count,
    companyCount: row.company_count,
    negativeMentionCount: row.negative_mention_count,
  };
}

function toMention(row: MentionRow): StoredAlertMention {
  return {
    candidateId: row.candidate_id,
    companyId: row.company_id,
    displayName: row.display_name,
    sentiment: row.sentiment,
    article: {
      id: row.article_id,
      title: row.title,
      snippet: row.snippet,
      outletName: row.outlet_name,
      outletUrl: row.outlet_url,
      googleUrl: row.google_url,
      publisherUrl: row.publisher_url,
      publishedAt: row.published_at,
      language: row.language,
      edition: row.edition,
    },
  };
}
