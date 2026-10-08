import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { RelevanceVerdict } from '../../domain/relevance';
import type { SentimentVerdict } from '../../domain/sentiment';
import { ClassifierOutputInvalid, ClassifierUnavailable } from '../classifier-errors';
import type { RelevanceClassifier } from '../relevance-classifier';
import type { SentimentClassifier } from '../sentiment-classifier';
import { classifyValidationSet, latencyFigures, scoreAgainstLabels, type ClassificationRun } from './evaluate';
import { parseValidationSet, type ValidationItem } from './validation-set';

const SET_PATH = join(__dirname, '..', '..', '..', 'test', 'fixtures', 'validation', 'validation-set.json');
const SET = parseValidationSet(JSON.parse(readFileSync(SET_PATH, 'utf8')), SET_PATH);

/** One real English-ambiguous, one English-clear and one Hebrew-ambiguous item from the committed set. */
function pickItems(): readonly [ValidationItem, ValidationItem, ValidationItem] {
  const find = (predicate: (item: ValidationItem) => boolean): ValidationItem => {
    const item = SET.items.find(predicate);
    if (item === undefined) throw new Error('the set lacks a needed item');
    return item;
  };
  return [
    find((item) => item.article.language === 'en' && item.nameKind === 'ambiguous'),
    find((item) => item.article.language === 'en' && item.nameKind === 'clear'),
    find((item) => item.article.language === 'he' && item.nameKind === 'ambiguous'),
  ];
}
const [AMBIGUOUS, CLEAR, HEBREW] = pickItems();
const ITEMS = [AMBIGUOUS, CLEAR, HEBREW];

/* Explicitly listed verdicts stand in for the model: these tests check the bookkeeping, not the model. */
class ScriptedRelevance implements RelevanceClassifier {
  constructor(private readonly answers: Map<string, boolean | Error>) {}
  judge(_company: CompanyProfile, article: ClassifiableArticle): Promise<RelevanceVerdict> {
    const answer = this.answers.get(article.title);
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve({ relevant: answer ?? false, reason: 'scripted' });
  }
}

class ScriptedSentiment implements SentimentClassifier {
  classify(): Promise<SentimentVerdict> {
    return Promise.resolve({ sentiment: 'neutral', reason: 'scripted' });
  }
}

/** A clock that advances 10 ms per reading. */
function steppingClock(): () => number {
  let now = 0;
  return () => (now += 10);
}

function ok<V>(verdict: V, durationMs = 10): { ok: true; verdict: V; durationMs: number } {
  return { ok: true, verdict, durationMs };
}

describe('classifyValidationSet', () => {
  it('asks both classifiers about every item, one at a time, after an untimed warm-up', async () => {
    const relevance = new ScriptedRelevance(new Map([[AMBIGUOUS.article.title, true]]));
    const order: string[] = [];
    const sentiment: SentimentClassifier = {
      classify: (_company, article) => {
        order.push(article.title);
        return Promise.resolve({ sentiment: 'positive', reason: 'scripted' });
      },
    };

    const run = await classifyValidationSet(ITEMS, { relevance, sentiment }, steppingClock());

    expect(run.warmUpMs).toBe(10);
    expect(run.results.map((result) => result.id)).toEqual(ITEMS.map((item) => item.id));
    expect(run.results[0]).toEqual({
      id: AMBIGUOUS.id,
      relevance: ok({ relevant: true, reason: 'scripted' }),
      sentiment: ok({ sentiment: 'positive', reason: 'scripted' }),
    });
    expect(order).toEqual(ITEMS.map((item) => item.article.title));
  });

  it('records an unusable answer and carries on', async () => {
    const relevance = new ScriptedRelevance(new Map([[CLEAR.article.title, new ClassifierOutputInvalid('unreadable answer', 'not json')]]));

    const run = await classifyValidationSet(ITEMS, { relevance, sentiment: new ScriptedSentiment() }, steppingClock());

    expect(run.results[1]?.relevance).toMatchObject({ ok: false, durationMs: 10 });
    expect(run.results).toHaveLength(3);
  });

  it('aborts when Ollama is unavailable', async () => {
    const relevance = new ScriptedRelevance(new Map([[CLEAR.article.title, new ClassifierUnavailable('down')]]));

    await expect(
      classifyValidationSet(ITEMS, { relevance, sentiment: new ScriptedSentiment() }, steppingClock()),
    ).rejects.toThrow(ClassifierUnavailable);
  });

  it('refuses an empty set', async () => {
    await expect(
      classifyValidationSet([], { relevance: new ScriptedRelevance(new Map()), sentiment: new ScriptedSentiment() }, steppingClock()),
    ).rejects.toThrow(RangeError);
  });
});

/** A run whose verdicts are spelled out per item. */
function runOf(verdicts: readonly [ValidationItem, boolean | null, SentimentVerdict['sentiment'] | null][]): ClassificationRun {
  return {
    warmUpMs: 0,
    results: verdicts.map(([item, relevant, sentiment], index) => ({
      id: item.id,
      relevance: relevant === null ? { ok: false, error: 'bad', durationMs: 100 } : ok({ relevant, reason: `r${index}` }, 100 * (index + 1)),
      sentiment: sentiment === null ? { ok: false, error: 'bad', durationMs: 50 } : ok({ sentiment, reason: `s${index}` }, 50 * (index + 1)),
    })),
  };
}

describe('scoreAgainstLabels', () => {
  const run = runOf([
    [AMBIGUOUS, true, 'positive'],
    [CLEAR, true, 'negative'],
    [HEBREW, false, 'neutral'],
  ]);

  it('scores relevance on every labelled item and sentiment on the relevant ones, per slice', () => {
    const scores = scoreAgainstLabels(ITEMS, run, [
      { id: AMBIGUOUS.id, relevant: false, sentiment: null }, // FP
      { id: CLEAR.id, relevant: true, sentiment: 'negative' }, // TP, sentiment right
      { id: HEBREW.id, relevant: true, sentiment: 'positive' }, // FN, sentiment wrong
    ]);

    const all = scores.groups.find((group) => group.key === 'all');
    expect(scores.labelled).toBe(3);
    expect(all?.relevance).toMatchObject({ truePositives: 1, falsePositives: 1, falseNegatives: 1, precision: 0.5, recall: 0.5 });
    expect(all?.sentiment).toMatchObject({ total: 2, correct: 1, accuracy: 0.5 });
    expect(all?.sentiment.confusion.positive.neutral).toBe(1);
    expect(scores.groups.find((group) => group.key === 'he')?.relevance).toMatchObject({ total: 1, falseNegatives: 1 });
    expect(scores.groups.find((group) => group.key === 'ambiguous')?.relevance).toMatchObject({ total: 2, falsePositives: 1, falseNegatives: 1 });
    expect(scores.groups.find((group) => group.key === 'clear')?.sentiment).toMatchObject({ total: 1, accuracy: 1 });
    expect(scores.disagreements.map((d) => [d.id, d.step])).toEqual([
      [AMBIGUOUS.id, 'relevance'],
      [HEBREW.id, 'relevance'],
      [HEBREW.id, 'sentiment'],
    ]);
  });

  it('leaves unlabelled items and unusable answers out of the scores', () => {
    const scores = scoreAgainstLabels(ITEMS, runOf([[AMBIGUOUS, null, null], [CLEAR, true, 'neutral'], [HEBREW, true, 'neutral']]), [
      { id: AMBIGUOUS.id, relevant: true, sentiment: 'neutral' },
      { id: CLEAR.id, relevant: true, sentiment: null },
    ]);

    expect(scores.labelled).toBe(2);
    expect(scores.unusable).toEqual({ relevance: 1, sentiment: 1 });
    expect(scores.groups[0]?.relevance.total).toBe(1);
    expect(scores.groups[0]?.sentiment.total).toBe(0);
  });
});

describe('latencyFigures', () => {
  it('summarizes each step, unusable answers included, and the share judged relevant', () => {
    const figures = latencyFigures(runOf([[AMBIGUOUS, true, 'neutral'], [CLEAR, false, null], [HEBREW, null, 'neutral']]));

    // Durations 100 ms (item 1), 200 ms (item 2) and 100 ms (the unusable answer on item 3).
    expect(figures.relevance).toMatchObject({ calls: 3, medianMs: 100, minMs: 100, maxMs: 200 });
    expect(figures.sentiment).toMatchObject({ calls: 3, medianMs: 50 });
    expect(figures.unusable).toEqual({ relevance: 1, sentiment: 1 });
    expect(figures.relevantShare).toBe(0.5);
  });

  it('has no relevant share without a usable relevance answer', () => {
    expect(latencyFigures(runOf([[AMBIGUOUS, null, null]])).relevantShare).toBeNull();
  });
});
