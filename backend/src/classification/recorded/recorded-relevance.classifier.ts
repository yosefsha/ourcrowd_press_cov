import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { RelevanceVerdict } from '../../domain/relevance';
import type { RelevanceClassifier } from '../relevance-classifier';
import { NoRecordedVerdict } from './no-recorded-verdict';
import { articleVerdictKey, type RecordedRelevance } from './recorded-verdicts';

/** In-memory `RelevanceClassifier` replaying recorded real Ollama verdicts (ADR-006). */
export class RecordedRelevanceClassifier implements RelevanceClassifier {
  private readonly verdicts: ReadonlyMap<string, RelevanceVerdict>;

  constructor(entries: readonly RecordedRelevance[]) {
    this.verdicts = new Map(entries.map((entry) => [articleVerdictKey(entry.company, entry.article), entry.verdict]));
  }

  judge(company: CompanyProfile, article: ClassifiableArticle): Promise<RelevanceVerdict> {
    const verdict = this.verdicts.get(articleVerdictKey(company, article));
    if (verdict === undefined) {
      return Promise.reject(new NoRecordedVerdict(`relevance of "${article.title}" to ${company.displayName}`));
    }
    return Promise.resolve(verdict);
  }
}
