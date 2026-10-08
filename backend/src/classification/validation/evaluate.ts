import type { RelevanceVerdict } from '../../domain/relevance';
import type { SentimentVerdict } from '../../domain/sentiment';
import { ClassifierOutputInvalid } from '../classifier-errors';
import type { RelevanceClassifier } from '../relevance-classifier';
import type { SentimentClassifier } from '../sentiment-classifier';
import type { HumanLabel } from './labelling-sheet';
import {
  scoreRelevance,
  scoreSentiment,
  summarizeLatency,
  type LatencySummary,
  type RelevanceScore,
  type SentimentScore,
} from './metrics';
import { toClassifiableArticle, type ValidationItem } from './validation-set';

/** What one classifier call answered, or that its answer was unusable. */
export type CallOutcome<V> =
  | { readonly ok: true; readonly verdict: V; readonly durationMs: number }
  | { readonly ok: false; readonly error: string; readonly durationMs: number };

/** Both classifiers' answers for one validation item. */
export interface ItemResult {
  readonly id: string;
  readonly relevance: CallOutcome<RelevanceVerdict>;
  readonly sentiment: CallOutcome<SentimentVerdict>;
}

export interface ClassificationRun {
  /** The untimed first call, which may include loading the model. */
  readonly warmUpMs: number;
  readonly results: readonly ItemResult[];
}

export interface EvaluatedClassifiers {
  readonly relevance: RelevanceClassifier;
  readonly sentiment: SentimentClassifier;
}

/** A monotonic clock in milliseconds (`performance.now` in production). */
export type Clock = () => number;

async function timed<V>(clock: Clock, call: () => Promise<V>): Promise<CallOutcome<V>> {
  const started = clock();
  try {
    const verdict = await call();
    return { ok: true, verdict, durationMs: clock() - started };
  } catch (error) {
    // An unusable answer is a classifier failure worth reporting; anything else
    // (Ollama unreachable) means the run cannot be measured, so it propagates.
    if (!(error instanceof ClassifierOutputInvalid)) throw error;
    return { ok: false, error: error.message, durationMs: clock() - started };
  }
}

/**
 * Asks both classifiers about every item, one call at a time as the pipeline
 * does, timing each call. Sentiment is asked for every item — not only the
 * ones judged relevant — so it can be scored against the human label on its
 * own (ADR-002) and its latency is sampled as often as relevance's. One
 * untimed relevance call first takes the model-load cost out of the figures.
 * `ClassifierUnavailable` aborts the run.
 */
export async function classifyValidationSet(
  items: readonly ValidationItem[],
  classifiers: EvaluatedClassifiers,
  clock: Clock,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<ClassificationRun> {
  const [first] = items;
  if (first === undefined) throw new RangeError('The validation set is empty');
  const warmUp = await timed(clock, () =>
    classifiers.relevance.judge(first.company, toClassifiableArticle(first.article)),
  );
  const results: ItemResult[] = [];
  for (const item of items) {
    const article = toClassifiableArticle(item.article);
    const relevance = await timed(clock, () => classifiers.relevance.judge(item.company, article));
    const sentiment = await timed(clock, () => classifiers.sentiment.classify(item.company, article));
    results.push({ id: item.id, relevance, sentiment });
    onProgress(results.length, items.length);
  }
  return { warmUpMs: warmUp.durationMs, results };
}

/** A slice of the set that is scored on its own. */
export const ITEM_GROUPS = [
  { key: 'all', title: 'All', includes: (): boolean => true },
  { key: 'en', title: 'English', includes: (item: ValidationItem): boolean => item.article.language === 'en' },
  { key: 'he', title: 'Hebrew', includes: (item: ValidationItem): boolean => item.article.language === 'he' },
  { key: 'ambiguous', title: 'Ambiguous names', includes: (item: ValidationItem): boolean => item.nameKind === 'ambiguous' },
  { key: 'clear', title: 'Clear-cut names', includes: (item: ValidationItem): boolean => item.nameKind === 'clear' },
] as const;

export interface GroupScore {
  readonly key: string;
  readonly title: string;
  readonly items: number;
  readonly relevance: RelevanceScore;
  readonly sentiment: SentimentScore;
}

/** A labelled item the model got wrong, for the report's error analysis. */
export interface Disagreement {
  readonly id: string;
  readonly step: 'relevance' | 'sentiment';
  readonly expected: string;
  readonly predicted: string;
  readonly reason: string;
}

export interface QualityScores {
  readonly labelled: number;
  readonly groups: readonly GroupScore[];
  readonly disagreements: readonly Disagreement[];
  /** Labelled items whose answer was unusable, per step. */
  readonly unusable: { readonly relevance: number; readonly sentiment: number };
}

/**
 * Scores the run against the human labels. Relevance is scored on every
 * labelled item; sentiment on the items labelled relevant that also carry a
 * sentiment label. An unusable answer is left out of the scores and counted.
 */
export function scoreAgainstLabels(
  items: readonly ValidationItem[],
  run: ClassificationRun,
  labels: readonly HumanLabel[],
): QualityScores {
  const byId = new Map(run.results.map((result) => [result.id, result]));
  const labelById = new Map(labels.map((label) => [label.id, label]));
  const labelled = items.filter((item) => labelById.has(item.id));
  const disagreements: Disagreement[] = [];
  let unusableRelevance = 0;
  let unusableSentiment = 0;

  for (const item of labelled) {
    const label = labelById.get(item.id) as HumanLabel;
    const result = byId.get(item.id);
    if (result === undefined) throw new RangeError(`No classification result for ${item.id}`);
    if (!result.relevance.ok) unusableRelevance += 1;
    else if (result.relevance.verdict.relevant !== label.relevant) {
      disagreements.push({
        id: item.id,
        step: 'relevance',
        expected: label.relevant ? 'relevant' : 'not relevant',
        predicted: result.relevance.verdict.relevant ? 'relevant' : 'not relevant',
        reason: result.relevance.verdict.reason,
      });
    }
    if (label.sentiment === null) continue;
    if (!result.sentiment.ok) unusableSentiment += 1;
    else if (result.sentiment.verdict.sentiment !== label.sentiment) {
      disagreements.push({
        id: item.id,
        step: 'sentiment',
        expected: label.sentiment,
        predicted: result.sentiment.verdict.sentiment,
        reason: result.sentiment.verdict.reason,
      });
    }
  }

  const groups = ITEM_GROUPS.map((group) => {
    const members = labelled.filter((item) => group.includes(item));
    const relevance = members.flatMap((item) => {
      const outcome = (byId.get(item.id) as ItemResult).relevance;
      const label = labelById.get(item.id) as HumanLabel;
      return outcome.ok ? [{ expected: label.relevant, predicted: outcome.verdict.relevant }] : [];
    });
    const sentiment = members.flatMap((item) => {
      const outcome = (byId.get(item.id) as ItemResult).sentiment;
      const expected = (labelById.get(item.id) as HumanLabel).sentiment;
      return outcome.ok && expected !== null ? [{ expected, predicted: outcome.verdict.sentiment }] : [];
    });
    return {
      key: group.key,
      title: group.title,
      items: members.length,
      relevance: scoreRelevance(relevance),
      sentiment: scoreSentiment(sentiment),
    };
  });

  return {
    labelled: labelled.length,
    groups,
    disagreements,
    unusable: { relevance: unusableRelevance, sentiment: unusableSentiment },
  };
}

export interface LatencyFigures {
  readonly relevance: LatencySummary | null;
  readonly sentiment: LatencySummary | null;
  readonly unusable: { readonly relevance: number; readonly sentiment: number };
  /** Share of usable relevance answers that said "relevant" — the pipeline's sentiment-call rate. */
  readonly relevantShare: number | null;
}

/** Per-call latency of each step, unusable answers included (they cost the same time). */
export function latencyFigures(run: ClassificationRun): LatencyFigures {
  const usableRelevance = run.results.flatMap((result) => (result.relevance.ok ? [result.relevance.verdict] : []));
  return {
    relevance: summarizeLatency(run.results.map((result) => result.relevance.durationMs)),
    sentiment: summarizeLatency(run.results.map((result) => result.sentiment.durationMs)),
    unusable: {
      relevance: run.results.filter((result) => !result.relevance.ok).length,
      sentiment: run.results.filter((result) => !result.sentiment.ok).length,
    },
    relevantShare:
      usableRelevance.length === 0
        ? null
        : usableRelevance.filter((verdict) => verdict.relevant).length / usableRelevance.length,
  };
}
