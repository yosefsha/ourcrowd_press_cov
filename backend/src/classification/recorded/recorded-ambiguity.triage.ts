import type { AmbiguityAssessment, AmbiguityTriage } from '../ambiguity-triage';
import { NoRecordedVerdict } from './no-recorded-verdict';
import { nameVerdictKey, type RecordedAmbiguity } from './recorded-verdicts';

/** In-memory `AmbiguityTriage` replaying recorded real Ollama assessments (ADR-006). */
export class RecordedAmbiguityTriage implements AmbiguityTriage {
  private readonly assessments: ReadonlyMap<string, AmbiguityAssessment>;

  constructor(entries: readonly RecordedAmbiguity[]) {
    this.assessments = new Map(entries.map((entry) => [nameVerdictKey(entry.name), entry.assessment]));
  }

  assess(name: string): Promise<AmbiguityAssessment> {
    const assessment = this.assessments.get(nameVerdictKey(name));
    if (assessment === undefined) {
      return Promise.reject(new NoRecordedVerdict(`ambiguity of the name "${name}"`));
    }
    return Promise.resolve(assessment);
  }
}
