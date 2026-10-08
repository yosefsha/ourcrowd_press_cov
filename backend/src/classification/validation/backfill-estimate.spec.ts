import { estimateBackfill, type BackfillEstimateInput } from './backfill-estimate';

/* Round numbers so every figure can be checked by hand. */
const INPUT: BackfillEstimateInput = {
  companies: 10,
  editions: 2,
  foundPerCompany: 5,
  classifiedPerCompany: 4,
  relevantShare: 0.5,
  relevance: { calls: 1, medianMs: 2000, p95Ms: 3000, minMs: 1000, maxMs: 4000 },
  sentiment: { calls: 1, medianMs: 1000, p95Ms: 2000, minMs: 500, maxMs: 3000 },
  newsRequestIntervalMs: 300,
};

describe('estimateBackfill', () => {
  it('adds a relevance call per classified Candidate and a sentiment call per relevant one, sequentially', () => {
    // 40 Candidates: 40 × 2 s + 20 × 1 s = 100 s at median; 40 × 3 s + 20 × 2 s = 160 s at p95.
    expect(estimateBackfill(INPUT)).toEqual({
      classifiedCandidates: 40,
      relevanceCalls: 40,
      sentimentCalls: 20,
      classificationMedianMs: 100_000,
      classificationP95Ms: 160_000,
      // 10 × 2 searches + 10 × 5 articles × 2 resolution requests = 120 requests × 300 ms.
      newsRequests: 120,
      newsSourceMinMs: 36_000,
    });
  });

  it('makes no sentiment calls when nothing is relevant', () => {
    expect(estimateBackfill({ ...INPUT, relevantShare: 0 })).toMatchObject({ sentimentCalls: 0, classificationMedianMs: 80_000 });
  });

  it('rejects a share outside 0–1', () => {
    expect(() => estimateBackfill({ ...INPUT, relevantShare: 1.5 })).toThrow(RangeError);
    expect(() => estimateBackfill({ ...INPUT, relevantShare: Number.NaN })).toThrow(RangeError);
  });
});
