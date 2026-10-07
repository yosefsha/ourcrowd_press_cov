import type { ClassifiableArticle } from '../domain/article';
import type { CompanyProfile } from '../domain/company';
import type { RelevanceVerdict } from '../domain/relevance';

/** Injection token for the `RelevanceClassifier` port. */
export const RELEVANCE_CLASSIFIER = Symbol('RELEVANCE_CLASSIFIER');

/** Judges whether a Candidate is actually about the Tracked Company (ADR-002, step 1). */
export interface RelevanceClassifier {
  /**
   * The Relevance Verdict for `article` as a Candidate for `company`. Throws
   * `ClassifierUnavailable` or `ClassifierOutputInvalid`.
   */
  judge(company: CompanyProfile, article: ClassifiableArticle): Promise<RelevanceVerdict>;
}
