import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { SentimentVerdict } from '../../domain/sentiment';
import type { SentimentClassifier } from '../sentiment-classifier';
import { NoRecordedVerdict } from './no-recorded-verdict';
import { articleVerdictKey, type RecordedSentiment } from './recorded-verdicts';

/** In-memory `SentimentClassifier` replaying recorded real Ollama verdicts (ADR-006). */
export class RecordedSentimentClassifier implements SentimentClassifier {
  private readonly verdicts: ReadonlyMap<string, SentimentVerdict>;

  constructor(entries: readonly RecordedSentiment[]) {
    this.verdicts = new Map(entries.map((entry) => [articleVerdictKey(entry.company, entry.article), entry.verdict]));
  }

  classify(company: CompanyProfile, article: ClassifiableArticle): Promise<SentimentVerdict> {
    const verdict = this.verdicts.get(articleVerdictKey(company, article));
    if (verdict === undefined) {
      return Promise.reject(new NoRecordedVerdict(`sentiment of "${article.title}" toward ${company.displayName}`));
    }
    return Promise.resolve(verdict);
  }
}
