/**
 * Where a Candidate stands in the relevance step (ADR-002). A Mention is a
 * Candidate whose relevance is `relevant`.
 */
export const RELEVANCES = ['pending', 'relevant', 'rejected'] as const;
export type Relevance = (typeof RELEVANCES)[number];

/**
 * How a Relevance Verdict was reached: by the classifier, or by the rule that
 * rejects a Candidate whose text never names the company.
 */
export const RELEVANCE_METHODS = ['llm', 'name_absent'] as const;
export type RelevanceMethod = (typeof RELEVANCE_METHODS)[number];

/** The judgement of whether a Candidate is actually about the Tracked Company. */
export interface RelevanceVerdict {
  readonly relevant: boolean;
  readonly reason: string;
}
