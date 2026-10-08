import type { AlertMention } from '../../../src/domain/alert-digest';
import type { Sentiment } from '../../../src/domain/sentiment';
import type { InMemoryMention } from '../../../src/alerts/notifiers/in-memory-alert-digest.store';
import { RECORDED_ARTICLES } from './recorded-google-news-articles';

export type RecordedArticleKey = keyof typeof RECORDED_ARTICLES;

/** Tracked Company ids the alert specs use, one per recorded company. */
export const COMPANY_IDS: Readonly<Record<string, number>> = { Morphisec: 5, ZutaCore: 1, OncoHost: 4 };

/**
 * A New Mention made from a recorded Google News article. The Sentiment is a
 * verdict listed explicitly by each spec: there are no recorded classifier
 * verdicts yet (#6), so specs must switch to those once they exist.
 */
export function recordedMention(
  key: RecordedArticleKey,
  candidateId: number,
  sentiment: Sentiment,
  confirmedInRunId: number,
): InMemoryMention {
  const { company, article } = RECORDED_ARTICLES[key];
  return {
    candidateId,
    companyId: COMPANY_IDS[company],
    displayName: company,
    sentiment,
    title: article.title,
    outletName: article.outletName,
    url: article.publisherUrl ?? article.googleUrl,
    publishedAt: article.publishedAt,
    confirmedInRunId,
  };
}

/** The `AlertMention` part of a recorded New Mention, as an Alert Digest lists it. */
export function asAlertMention(mention: InMemoryMention): AlertMention {
  return {
    candidateId: mention.candidateId,
    sentiment: mention.sentiment,
    title: mention.title,
    outletName: mention.outletName,
    url: mention.url,
    publishedAt: mention.publishedAt,
  };
}
