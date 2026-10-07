import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import type { FoundArticle } from '../../domain/article';
import type { RelevanceMethod } from '../../domain/relevance';
import type { SentimentVerdict } from '../../domain/sentiment';
import {
  type CandidateRepository,
  CandidateStoreFailed,
  type PendingCandidate,
  type RecordedCandidates,
} from '../candidate.repository';

interface PendingRow {
  id: number;
  google_article_id: string;
  title: string;
  snippet: string;
  outlet_name: string;
  published_at: Date;
  language: string;
}

/**
 * Articles and Candidates in Postgres (`articles`, `candidates`). Works through
 * an `EntityManager`, so a caller already inside a transaction (the e2e specs)
 * gets savepoints instead of a second connection.
 */
@Injectable()
export class PostgresCandidateRepository implements CandidateRepository {
  constructor(private readonly manager: EntityManager) {}

  async recordFound(companyId: number, articles: readonly FoundArticle[], runId: number): Promise<RecordedCandidates> {
    return this.guard('store found Articles', () =>
      this.manager.transaction(async (manager) => {
        let created = 0;
        for (const article of articles) {
          const articleId = await this.upsertArticle(manager, article);
          const inserted = await manager.query<unknown[]>(
            `INSERT INTO candidates (article_id, company_id, fetched_in_run_id)
             VALUES ($1, $2, $3)
             ON CONFLICT ON CONSTRAINT "UQ_candidates_article_company" DO NOTHING
             RETURNING id`,
            [articleId, companyId, runId],
          );
          created += inserted.length;
        }
        return { created };
      }),
    );
  }

  async pendingFor(companyId: number): Promise<readonly PendingCandidate[]> {
    const rows = await this.guard('read pending Candidates', async () =>
      await this.manager.query<PendingRow[]>(
        `SELECT c.id, a.google_article_id, a.title, a.snippet, a.outlet_name, a.published_at, a.language
           FROM candidates c
           JOIN articles a ON a.id = c.article_id
          WHERE c.company_id = $1 AND c.relevance = 'pending'
          ORDER BY a.published_at DESC, c.id`,
        [companyId],
      ),
    );
    return rows.map((row) => ({
      id: row.id,
      googleArticleId: row.google_article_id,
      article: {
        title: row.title,
        snippet: row.snippet,
        outletName: row.outlet_name,
        publishedAt: new Date(row.published_at),
        language: row.language,
      },
    }));
  }

  async recordRejection(candidateId: number, method: RelevanceMethod, reason: string): Promise<void> {
    await this.guard('record a rejection', () =>
      this.manager.query(
        `UPDATE candidates
            SET relevance = 'rejected', relevance_method = $2, relevance_reason = $3, relevance_classified_at = now()
          WHERE id = $1 AND relevance = 'pending'`,
        [candidateId, method, reason],
      ),
    );
  }

  async recordMention(
    candidateId: number,
    relevanceReason: string,
    sentiment: SentimentVerdict,
    runId: number,
  ): Promise<void> {
    await this.guard('record a Mention', () =>
      this.manager.query(
        `UPDATE candidates
            SET relevance = 'relevant', relevance_method = 'llm', relevance_reason = $2, relevance_classified_at = now(),
                sentiment = $3, sentiment_reason = $4, sentiment_classified_at = now(),
                confirmed_in_run_id = $5, confirmed_at = now()
          WHERE id = $1 AND relevance = 'pending'`,
        [candidateId, relevanceReason, sentiment.sentiment, sentiment.reason, runId],
      ),
    );
  }

  async discardCompany(companyId: number): Promise<void> {
    await this.guard('discard a company’s Candidates', () =>
      this.manager.transaction(async (manager) => {
        const removed = await manager.query<[{ article_id: number }[], number]>(
          `DELETE FROM candidates WHERE company_id = $1 RETURNING article_id`,
          [companyId],
        );
        const articleIds = [...new Set(removed[0].map((row) => row.article_id))];
        if (articleIds.length === 0) return;
        await manager.query(
          `DELETE FROM articles a
            WHERE a.id = ANY($1::int[])
              AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.article_id = a.id)`,
          [articleIds],
        );
      }),
    );
  }

  /** The Article's id, inserting it on first sight; a known Article is kept as first stored. */
  private async upsertArticle(manager: EntityManager, article: FoundArticle): Promise<number> {
    const rows = await manager.query<{ id: number }[]>(
      `INSERT INTO articles (google_article_id, title, snippet, outlet_name, outlet_url, google_url,
                             publisher_url, published_at, language, edition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT ON CONSTRAINT "UQ_articles_google_article_id"
       DO UPDATE SET publisher_url = COALESCE(articles.publisher_url, EXCLUDED.publisher_url)
       RETURNING id`,
      [
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
      ],
    );
    const [row] = rows;
    if (row === undefined) throw new CandidateStoreFailed(`Article ${article.googleArticleId} was not stored`);
    return row.id;
  }

  private async guard<T>(action: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof CandidateStoreFailed) throw error;
      throw new CandidateStoreFailed(`Could not ${action}`, { cause: error });
    }
  }
}
