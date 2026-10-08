import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { estimateBackfill } from './backfill-estimate';
import type { LatencyFigures, QualityScores } from './evaluate';
import { scoreRelevance, scoreSentiment } from './metrics';
import { renderValidationReport, type ReportInput } from './validation-report';
import { parseValidationSet } from './validation-set';

const SET_PATH = join(__dirname, '..', '..', '..', 'test', 'fixtures', 'validation', 'validation-set.json');
const SET = parseValidationSet(JSON.parse(readFileSync(SET_PATH, 'utf8')), SET_PATH);

const LATENCY: LatencyFigures = {
  relevance: { calls: 60, medianMs: 2000, p95Ms: 3000, minMs: 1500, maxMs: 4000 },
  sentiment: { calls: 60, medianMs: 1000, p95Ms: 2000, minMs: 800, maxMs: 2500 },
  unusable: { relevance: 0, sentiment: 0 },
  relevantShare: 0.5,
};

const ESTIMATE_INPUT = {
  companies: 258,
  editions: 2,
  foundPerCompany: 15,
  classifiedPerCompany: 10,
  relevantShare: 0.5,
  relevance: LATENCY.relevance!,
  sentiment: LATENCY.sentiment!,
  newsRequestIntervalMs: 300,
};

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    ranAt: new Date('2026-10-08T12:00:00Z'),
    model: 'qwen2.5:7b',
    promptVersions: { relevance: 'relevance-v1', sentiment: 'sentiment-v1' },
    machine: 'test machine',
    items: SET.items,
    labelsPath: 'docs/validation/labelling-sheet.md',
    quality: null,
    unlabelled: SET.items.length,
    warmUpMs: 5000,
    latency: LATENCY,
    backfill: {
      volume: {
        sampledCompanies: 20,
        meanCandidatesPerCompany: 12,
        meanClassifiedPerCompany: 10,
        meanFoundPerEdition: { 'en-US': 13, 'he-IL': 2 },
        cappedSearches: 2,
        searches: 40,
      },
      volumeRecordedAt: new Date('2026-10-08T00:00:00Z'),
      sampleRule: 'a sample',
      input: ESTIMATE_INPUT,
      estimate: estimateBackfill(ESTIMATE_INPUT),
    },
    ...overrides,
  };
}

describe('renderValidationReport', () => {
  it('states the model, prompt versions and date, and that labels are pending', () => {
    const report = renderValidationReport(input());

    expect(report).toContain('| Date | 2026-10-08 |');
    expect(report).toContain('`qwen2.5:7b`');
    expect(report).toContain('relevance `relevance-v1`, sentiment `sentiment-v1`');
    expect(report).toContain('**Labels pending.**');
    expect(report).not.toContain('### Relevance');
  });

  it('reports latency and the Backfill estimate', () => {
    const report = renderValidationReport(input());

    expect(report).toContain('| relevance | 60 | 2.00 s | 3.00 s | 1.50 s | 4.00 s |');
    expect(report).toContain('| sentiment | 60 | 1.00 s | 2.00 s | 0.80 s | 2.50 s |');
    // 2580 relevance × 2 s + 1290 sentiment × 1 s = 6450 s = 1 h 48 min.
    expect(report).toContain('| **Classification time at median latency** | **1 h 48 min** |');
    expect(report).toContain('| Relevance calls + sentiment calls | 2580 + 1290 |');
  });

  it('shows the composition of the set', () => {
    const hebrew = SET.items.filter((item) => item.article.language === 'he').length;

    expect(renderValidationReport(input())).toMatch(new RegExp(`\\| he \\| \\d+ \\| \\d+ \\| ${hebrew} \\|`));
  });

  it('reports quality per slice, confusion matrices and disagreements once labels exist', () => {
    const quality: QualityScores = {
      labelled: 3,
      groups: [
        {
          key: 'all',
          title: 'All',
          items: 3,
          relevance: scoreRelevance([
            { expected: true, predicted: true },
            { expected: false, predicted: true },
            { expected: true, predicted: true },
          ]),
          sentiment: scoreSentiment([
            { expected: 'positive', predicted: 'positive' },
            { expected: 'negative', predicted: 'neutral' },
          ]),
        },
      ],
      disagreements: [{ id: 'x-en-01', step: 'relevance', expected: 'not relevant', predicted: 'relevant', reason: 'a | b' }],
      unusable: { relevance: 0, sentiment: 0 },
    };

    const report = renderValidationReport(input({ quality, unlabelled: 57 }));

    expect(report).toContain('3 of 60 items labelled, 57 still unlabelled');
    expect(report).toContain('| All | 3 | 2 | 1 | 0 | 0 | 66.7% | 100.0% |');
    expect(report).toContain('| All | 2 | 1 | 50.0% |');
    expect(report).toContain('| **negative** | 0 | 0 | 1 |');
    expect(report).toContain('| x-en-01 | relevance | not relevant | relevant | a \\| b |');
    expect(report).not.toContain('Labels pending');
  });

  it('says so when no estimate could be made', () => {
    expect(renderValidationReport(input({ backfill: null }))).toContain('Not available: no latency was measured.');
  });
});
