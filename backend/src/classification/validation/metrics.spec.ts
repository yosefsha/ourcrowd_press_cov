import { percentile, scoreRelevance, scoreSentiment, summarizeLatency } from './metrics';

/* Tiny hand-computable cases: the expected figures can be checked on paper. */

describe('scoreRelevance', () => {
  it('counts the four outcomes and derives precision and recall', () => {
    // 2 TP, 1 FP, 1 FN, 3 TN → precision 2/3, recall 2/3.
    const score = scoreRelevance([
      { expected: true, predicted: true },
      { expected: true, predicted: true },
      { expected: false, predicted: true },
      { expected: true, predicted: false },
      { expected: false, predicted: false },
      { expected: false, predicted: false },
      { expected: false, predicted: false },
    ]);

    expect(score).toEqual({
      total: 7,
      truePositives: 2,
      falsePositives: 1,
      falseNegatives: 1,
      trueNegatives: 3,
      precision: 2 / 3,
      recall: 2 / 3,
    });
  });

  it('distinguishes precision from recall', () => {
    // 1 TP, 0 FP, 3 FN → precision 1, recall 1/4.
    const score = scoreRelevance([
      { expected: true, predicted: true },
      { expected: true, predicted: false },
      { expected: true, predicted: false },
      { expected: true, predicted: false },
    ]);

    expect(score.precision).toBe(1);
    expect(score.recall).toBe(0.25);
  });

  it('has no precision when nothing was judged relevant, and no recall when nothing is relevant', () => {
    expect(scoreRelevance([{ expected: true, predicted: false }]).precision).toBeNull();
    expect(scoreRelevance([{ expected: false, predicted: true }]).recall).toBeNull();
    expect(scoreRelevance([])).toMatchObject({ total: 0, precision: null, recall: null });
  });
});

describe('scoreSentiment', () => {
  it('computes accuracy and fills the confusion matrix by [human][model]', () => {
    // 3 of 5 correct; one negative read as neutral, one neutral read as positive.
    const score = scoreSentiment([
      { expected: 'positive', predicted: 'positive' },
      { expected: 'negative', predicted: 'negative' },
      { expected: 'negative', predicted: 'neutral' },
      { expected: 'neutral', predicted: 'neutral' },
      { expected: 'neutral', predicted: 'positive' },
    ]);

    expect(score.total).toBe(5);
    expect(score.correct).toBe(3);
    expect(score.accuracy).toBe(0.6);
    expect(score.confusion).toEqual({
      positive: { positive: 1, negative: 0, neutral: 0 },
      negative: { positive: 0, negative: 1, neutral: 1 },
      neutral: { positive: 1, negative: 0, neutral: 1 },
    });
  });

  it('has no accuracy and an all-zero matrix when there is nothing to score', () => {
    const score = scoreSentiment([]);

    expect(score.accuracy).toBeNull();
    expect(score.confusion.negative).toEqual({ positive: 0, negative: 0, neutral: 0 });
  });
});

describe('percentile', () => {
  it('takes the middle value of an odd list and the mean of the middle pair of an even one', () => {
    expect(percentile([3, 1, 2], 50)).toBe(2);
    expect(percentile([4, 1, 3, 2], 50)).toBe(2.5);
  });

  it('interpolates between the nearest ranks', () => {
    // 1..21: rank 0.95 × 20 = 19 → the 20th value exactly.
    expect(percentile(Array.from({ length: 21 }, (_, i) => i + 1), 95)).toBe(20);
    // 10, 20: rank 0.95 → 10 + 0.95 × 10.
    expect(percentile([20, 10], 95)).toBeCloseTo(19.5);
  });

  it('returns the extremes at 0 and 100 and the only value of a single-item list', () => {
    expect(percentile([5, 9, 7], 0)).toBe(5);
    expect(percentile([5, 9, 7], 100)).toBe(9);
    expect(percentile([42], 95)).toBe(42);
  });

  it('rejects an empty list and an out-of-range percentile', () => {
    expect(() => percentile([], 50)).toThrow(RangeError);
    expect(() => percentile([1], 101)).toThrow(RangeError);
    expect(() => percentile([1], -1)).toThrow(RangeError);
    expect(() => percentile([1], Number.NaN)).toThrow(RangeError);
  });
});

describe('summarizeLatency', () => {
  it('reports count, median, p95 and range', () => {
    expect(summarizeLatency([100, 300, 200, 400])).toEqual({
      calls: 4,
      medianMs: 250,
      p95Ms: 385,
      minMs: 100,
      maxMs: 400,
    });
  });

  it('is null when nothing was timed', () => {
    expect(summarizeLatency([])).toBeNull();
  });
});
