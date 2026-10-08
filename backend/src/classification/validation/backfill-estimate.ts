import type { LatencySummary } from './metrics';

/** Requests a News Source makes to resolve one article's publisher URL (article page + decode). */
export const PUBLISHER_URL_REQUESTS_PER_ARTICLE = 2;

export interface BackfillEstimateInput {
  /** Tracked Companies collected. */
  readonly companies: number;
  /** News Editions searched per company. */
  readonly editions: number;
  /** Articles found per company, summed over editions (each one has its publisher URL resolved). */
  readonly foundPerCompany: number;
  /** Candidates per company that pass the name check and reach the classifier. */
  readonly classifiedPerCompany: number;
  /** Share of classified Candidates the model judges relevant, so that also get a sentiment call (0–1). */
  readonly relevantShare: number;
  readonly relevance: LatencySummary;
  readonly sentiment: LatencySummary;
  /** Minimum spacing the collector keeps between two Google News requests. */
  readonly newsRequestIntervalMs: number;
}

export interface BackfillEstimate {
  readonly classifiedCandidates: number;
  readonly relevanceCalls: number;
  readonly sentimentCalls: number;
  /** Sequential classification time at median latency. */
  readonly classificationMedianMs: number;
  /** Sequential classification time if every call took the p95 latency (pessimistic). */
  readonly classificationP95Ms: number;
  readonly newsRequests: number;
  /** Lower bound of the News Source's time: its requests at the throttle's minimum spacing. */
  readonly newsSourceMinMs: number;
}

/**
 * Full-Backfill duration as the pipeline runs it (#9): one company at a time,
 * every Candidate that passes the name check gets a relevance call, the
 * relevant ones a sentiment call, all sequentially.
 */
export function estimateBackfill(input: BackfillEstimateInput): BackfillEstimate {
  if (!(input.relevantShare >= 0 && input.relevantShare <= 1)) {
    throw new RangeError(`relevantShare ${input.relevantShare} is outside 0–1`);
  }
  const classifiedCandidates = Math.round(input.companies * input.classifiedPerCompany);
  const relevanceCalls = classifiedCandidates;
  const sentimentCalls = Math.round(classifiedCandidates * input.relevantShare);
  const newsRequests = Math.round(
    input.companies * input.editions + input.companies * input.foundPerCompany * PUBLISHER_URL_REQUESTS_PER_ARTICLE,
  );
  return {
    classifiedCandidates,
    relevanceCalls,
    sentimentCalls,
    classificationMedianMs: relevanceCalls * input.relevance.medianMs + sentimentCalls * input.sentiment.medianMs,
    classificationP95Ms: relevanceCalls * input.relevance.p95Ms + sentimentCalls * input.sentiment.p95Ms,
    newsRequests,
    newsSourceMinMs: newsRequests * input.newsRequestIntervalMs,
  };
}
