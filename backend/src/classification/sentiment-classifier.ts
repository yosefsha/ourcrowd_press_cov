import type { ClassifiableArticle } from '../domain/article';
import type { CompanyProfile } from '../domain/company';
import type { SentimentVerdict } from '../domain/sentiment';

/** Injection token for the `SentimentClassifier` port. */
export const SENTIMENT_CLASSIFIER = Symbol('SENTIMENT_CLASSIFIER');

/** Judges a Mention's Sentiment toward the Tracked Company (ADR-002, step 2). */
export interface SentimentClassifier {
  /**
   * The Sentiment of `article` toward `company` — not the article's overall
   * tone. Called only for Mentions. Throws `ClassifierUnavailable` or
   * `ClassifierOutputInvalid`.
   */
  classify(company: CompanyProfile, article: ClassifiableArticle): Promise<SentimentVerdict>;
}
