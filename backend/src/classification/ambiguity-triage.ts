/** Injection token for the `AmbiguityTriage` port. */
export const AMBIGUITY_TRIAGE = Symbol('AMBIGUITY_TRIAGE');

/** Whether a news search for a name would mostly return unrelated articles. */
export interface AmbiguityAssessment {
  readonly ambiguous: boolean;
  readonly reason: string;
}

/**
 * The one-off question asked of each company at import (ADR-010): would a news
 * search for this exact name mostly return unrelated articles? A company judged
 * ambiguous starts as Needs Review.
 */
export interface AmbiguityTriage {
  /** Throws `ClassifierUnavailable` or `ClassifierOutputInvalid`. */
  assess(name: string): Promise<AmbiguityAssessment>;
}
