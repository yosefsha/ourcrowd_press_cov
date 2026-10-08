import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { Sentiment } from '../../domain/sentiment';
import {
  AlertDigestStoreUnavailable,
  type AlertDigestStore,
  type CreatedAlertDigest,
  type NewMention,
  type StoredRunDigest,
} from './alert-digest.store';

interface NewMentionRow {
  readonly candidate_id: number;
  readonly company_id: number;
  readonly display_name: string;
  readonly sentiment: Sentiment;
  readonly title: string;
  readonly outlet_name: string;
  readonly url: string;
  readonly published_at: Date;
}

interface DigestRow {
  readonly id: number;
  readonly created_at: Date;
  readonly acknowledged_at: Date | null;
}

/** A judged Mention: relevant, with a Sentiment. */
const MENTION_SELECT = `
  SELECT c.id AS candidate_id, c.company_id, tc.display_name, c.sentiment,
         a.title, a.outlet_name, COALESCE(a.publisher_url, a.google_url) AS url, a.published_at
    FROM candidates c
    JOIN articles a ON a.id = c.article_id
    JOIN tracked_companies tc ON tc.id = c.company_id`;

const IS_JUDGED_MENTION = `c.relevance = 'relevant' AND c.sentiment IS NOT NULL`;

/** New Mentions and Alert Digests in Postgres, for the collector. */
@Injectable()
export class PostgresAlertDigestStore implements AlertDigestStore {
  constructor(private readonly dataSource: DataSource) {}

  findNewMentions(runId: number, publishedSince: Date): Promise<readonly NewMention[]> {
    return this.guard(`finding New Mentions of Run ${runId}`, async () => {
      const rows = await this.dataSource.query<NewMentionRow[]>(
        `${MENTION_SELECT}
          WHERE c.confirmed_in_run_id = $1 AND ${IS_JUDGED_MENTION} AND a.published_at >= $2`,
        [runId, publishedSince],
      );
      return rows.map(toNewMention);
    });
  }

  findDigestForRun(runId: number): Promise<StoredRunDigest | null> {
    return this.guard(`reading the Alert Digest of Run ${runId}`, async () => {
      const [digest] = await this.dataSource.query<DigestRow[]>(
        `SELECT id, created_at, acknowledged_at FROM alert_digests WHERE run_id = $1`,
        [runId],
      );
      if (digest === undefined) return null;
      const rows = await this.dataSource.query<NewMentionRow[]>(
        `${MENTION_SELECT}
           JOIN alert_digest_items i ON i.candidate_id = c.id
          WHERE i.digest_id = $1 AND ${IS_JUDGED_MENTION}`,
        [digest.id],
      );
      return {
        id: digest.id,
        createdAt: digest.created_at,
        acknowledgedAt: digest.acknowledged_at,
        mentions: rows.map(toNewMention),
      };
    });
  }

  createDigest(runId: number, candidateIds: readonly number[]): Promise<CreatedAlertDigest> {
    return this.guard(`storing the Alert Digest of Run ${runId}`, () =>
      this.dataSource.transaction(async (manager) => {
        const [digest] = await manager.query<DigestRow[]>(
          `INSERT INTO alert_digests (run_id) VALUES ($1) RETURNING id, created_at, acknowledged_at`,
          [runId],
        );
        await manager.query(
          `INSERT INTO alert_digest_items (digest_id, candidate_id) SELECT $1, unnest($2::int[])`,
          [digest.id, candidateIds],
        );
        return { id: digest.id, createdAt: digest.created_at };
      }),
    );
  }

  /** Database errors become the port's own error; the driver error is kept as the cause. */
  private async guard<T>(action: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw new AlertDigestStoreUnavailable(`Failed ${action}`, { cause: error });
    }
  }
}

function toNewMention(row: NewMentionRow): NewMention {
  return {
    candidateId: row.candidate_id,
    companyId: row.company_id,
    displayName: row.display_name,
    sentiment: row.sentiment,
    title: row.title,
    outletName: row.outlet_name,
    url: row.url,
    publishedAt: row.published_at,
  };
}
