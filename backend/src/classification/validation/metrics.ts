import { SENTIMENTS, type Sentiment } from '../../domain/sentiment';

/** One relevance judgement against its human label. */
export interface RelevanceOutcome {
  readonly expected: boolean;
  readonly predicted: boolean;
}

/** One sentiment judgement against its human label. */
export interface SentimentOutcome {
  readonly expected: Sentiment;
  readonly predicted: Sentiment;
}

export interface RelevanceScore {
  readonly total: number;
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly trueNegatives: number;
  /** Of the Candidates judged relevant, the share that really are; null when none was judged relevant. */
  readonly precision: number | null;
  /** Of the really relevant Candidates, the share judged relevant; null when none is relevant. */
  readonly recall: number | null;
}

/** Counts by `[expected][predicted]` sentiment. */
export type ConfusionMatrix = Readonly<Record<Sentiment, Readonly<Record<Sentiment, number>>>>;

export interface SentimentScore {
  readonly total: number;
  readonly correct: number;
  /** Null when there is nothing to score. */
  readonly accuracy: number | null;
  readonly confusion: ConfusionMatrix;
}

export interface LatencySummary {
  readonly calls: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/** Precision and recall of the relevance step, "relevant" being the positive class. */
export function scoreRelevance(outcomes: readonly RelevanceOutcome[]): RelevanceScore {
  const count = (expected: boolean, predicted: boolean): number =>
    outcomes.filter((outcome) => outcome.expected === expected && outcome.predicted === predicted).length;
  const truePositives = count(true, true);
  const falsePositives = count(false, true);
  const falseNegatives = count(true, false);
  return {
    total: outcomes.length,
    truePositives,
    falsePositives,
    falseNegatives,
    trueNegatives: count(false, false),
    precision: ratio(truePositives, truePositives + falsePositives),
    recall: ratio(truePositives, truePositives + falseNegatives),
  };
}

/** Accuracy and the confusion matrix of the sentiment step. */
export function scoreSentiment(outcomes: readonly SentimentOutcome[]): SentimentScore {
  const confusion = Object.fromEntries(
    SENTIMENTS.map((expected) => [
      expected,
      Object.fromEntries(
        SENTIMENTS.map((predicted) => [
          predicted,
          outcomes.filter((outcome) => outcome.expected === expected && outcome.predicted === predicted).length,
        ]),
      ),
    ]),
  ) as unknown as ConfusionMatrix;
  const correct = outcomes.filter((outcome) => outcome.expected === outcome.predicted).length;
  return { total: outcomes.length, correct, accuracy: ratio(correct, outcomes.length), confusion };
}

/**
 * The `p`-th percentile (0–100) of `values`, interpolating linearly between
 * the two nearest ranks (so the 50th of an even-sized list is the mean of its
 * middle pair). Throws for an empty list or a `p` outside 0–100.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new RangeError('No values to take a percentile of');
  if (!(p >= 0 && p <= 100)) throw new RangeError(`Percentile ${p} is outside 0–100`);
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const low = sorted[lower];
  const high = sorted[upper];
  return low + (high - low) * (rank - lower);
}

/** Median, 95th percentile and range of per-call latencies; null when no call was timed. */
export function summarizeLatency(durationsMs: readonly number[]): LatencySummary | null {
  if (durationsMs.length === 0) return null;
  return {
    calls: durationsMs.length,
    medianMs: percentile(durationsMs, 50),
    p95Ms: percentile(durationsMs, 95),
    minMs: Math.min(...durationsMs),
    maxMs: Math.max(...durationsMs),
  };
}
