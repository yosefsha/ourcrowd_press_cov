import { SENTIMENTS } from '../../domain/sentiment';
import type { BackfillEstimate, BackfillEstimateInput } from './backfill-estimate';
import type { VolumeSummary } from './candidate-volume';
import type { LatencyFigures, QualityScores } from './evaluate';
import type { LatencySummary } from './metrics';
import { NAME_KINDS, type ValidationItem } from './validation-set';

export interface ReportInput {
  readonly ranAt: Date;
  readonly model: string;
  readonly promptVersions: { readonly relevance: string; readonly sentiment: string };
  /** Where it ran, e.g. `darwin arm64, Apple M2 Pro, 32 GB`. */
  readonly machine: string;
  readonly items: readonly ValidationItem[];
  /** The labels file, relative to the repository root. */
  readonly labelsPath: string;
  /** Null until at least one item is labelled. */
  readonly quality: QualityScores | null;
  readonly unlabelled: number;
  readonly warmUpMs: number;
  readonly latency: LatencyFigures;
  readonly backfill: {
    readonly volume: VolumeSummary;
    readonly volumeRecordedAt: Date;
    readonly sampleRule: string;
    readonly input: BackfillEstimateInput;
    readonly estimate: BackfillEstimate;
  } | null;
}

/** Model output (untrusted, may echo article text) as one escaped table cell. */
function tableText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}

function hours(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, '0')} min`;
}

function compositionTable(items: readonly ValidationItem[]): string[] {
  const languages = [...new Set(items.map((item) => item.article.language))].sort();
  const cell = (language: string | null, kind: string | null): number =>
    items.filter(
      (item) => (language === null || item.article.language === language) && (kind === null || item.nameKind === kind),
    ).length;
  return [
    `| Language | ${NAME_KINDS.join(' | ')} | total |`,
    `|---|${NAME_KINDS.map(() => '---:').join('|')}|---:|`,
    ...languages.map((language) => `| ${language} | ${NAME_KINDS.map((kind) => cell(language, kind)).join(' | ')} | ${cell(language, null)} |`),
    `| **all** | ${NAME_KINDS.map((kind) => cell(null, kind)).join(' | ')} | **${items.length}** |`,
  ];
}

function companiesLine(items: readonly ValidationItem[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = `${item.company.displayName} (${item.nameKind}, ${item.article.language})`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, value]) => `${key} ×${value}`).join(' · ');
}

function qualitySection(input: ReportInput): string[] {
  const { quality } = input;
  if (quality === null) {
    return [
      '## Quality',
      '',
      `**Labels pending.** None of the ${input.items.length} items is labelled yet. Fill \`${input.labelsPath}\` ` +
        '(relevant y/n, sentiment pos/neg/neu) and re-run `npm run eval:classifiers`; relevance precision/recall and ' +
        'sentiment accuracy with confusion matrices will then appear here, broken down by language and name ambiguity.',
      '',
    ];
  }
  const lines = [
    '## Quality',
    '',
    `Scored against human labels in \`${input.labelsPath}\`: ${quality.labelled} of ${input.items.length} items labelled` +
      (input.unlabelled > 0 ? `, ${input.unlabelled} still unlabelled (left out).` : '.') +
      ' Relevance treats "relevant" as the positive class. Sentiment is scored on the items labelled relevant, ' +
      'independently of the relevance verdict (ADR-002).',
    '',
    '### Relevance',
    '',
    '| Slice | labelled | TP | FP | FN | TN | precision | recall |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...quality.groups.map(
      ({ title, relevance: r }) =>
        `| ${title} | ${r.total} | ${r.truePositives} | ${r.falsePositives} | ${r.falseNegatives} | ${r.trueNegatives} | ${percent(r.precision)} | ${percent(r.recall)} |`,
    ),
    '',
    '### Sentiment',
    '',
    '| Slice | scored | correct | accuracy |',
    '|---|---:|---:|---:|',
    ...quality.groups.map(
      ({ title, sentiment: s }) => `| ${title} | ${s.total} | ${s.correct} | ${percent(s.accuracy)} |`,
    ),
    '',
  ];
  for (const group of quality.groups) {
    if (group.sentiment.total === 0) continue;
    lines.push(
      `Confusion matrix — ${group.title} (rows: human label, columns: model):`,
      '',
      `| | ${SENTIMENTS.join(' | ')} |`,
      `|---|${SENTIMENTS.map(() => '---:').join('|')}|`,
      ...SENTIMENTS.map(
        (expected) =>
          `| **${expected}** | ${SENTIMENTS.map((predicted) => group.sentiment.confusion[expected][predicted]).join(' | ')} |`,
      ),
      '',
    );
  }
  if (quality.unusable.relevance + quality.unusable.sentiment > 0) {
    lines.push(
      `Unusable answers (left out of the scores): ${quality.unusable.relevance} relevance, ${quality.unusable.sentiment} sentiment.`,
      '',
    );
  }
  lines.push('### Disagreements', '');
  if (quality.disagreements.length === 0) {
    lines.push('None.', '');
  } else {
    lines.push(
      '| id | step | human | model | model reason |',
      '|---|---|---|---|---|',
      ...quality.disagreements.map(
        (d) => `| ${d.id} | ${d.step} | ${d.expected} | ${d.predicted} | ${tableText(d.reason)} |`,
      ),
      '',
    );
  }
  return lines;
}

function latencyRow(name: string, summary: LatencySummary | null): string {
  return summary === null
    ? `| ${name} | 0 | n/a | n/a | n/a | n/a |`
    : `| ${name} | ${summary.calls} | ${seconds(summary.medianMs)} | ${seconds(summary.p95Ms)} | ${seconds(summary.minMs)} | ${seconds(summary.maxMs)} |`;
}

function latencySection(input: ReportInput): string[] {
  const { latency } = input;
  return [
    '## Latency per call',
    '',
    `Measured on ${input.machine}: one request in flight at a time (as the pipeline classifies), temperature 0, ` +
      `structured JSON output. Both steps were asked about all ${input.items.length} items. One untimed warm-up call ` +
      `came first (${seconds(input.warmUpMs)}).`,
    '',
    '| Call | calls | median | p95 | min | max |',
    '|---|---:|---:|---:|---:|---:|',
    latencyRow('relevance', latency.relevance),
    latencyRow('sentiment', latency.sentiment),
    '',
    `Unusable answers (timed, but invalid after one retry): ${latency.unusable.relevance} relevance, ${latency.unusable.sentiment} sentiment.`,
    '',
  ];
}

function backfillSection(input: ReportInput): string[] {
  const { backfill } = input;
  if (backfill === null) {
    return ['## Full Backfill estimate', '', 'Not available: no latency was measured.', ''];
  }
  const { volume, estimate, input: assumed } = backfill;
  const onlyRelevance = estimate.relevanceCalls * assumed.relevance.medianMs;
  const everySentiment = onlyRelevance + estimate.classifiedCandidates * assumed.sentiment.medianMs;
  const perEdition = Object.entries(volume.meanFoundPerEdition)
    .map(([edition, found]) => `${edition} ${found.toFixed(1)}`)
    .join(', ');
  return [
    '## Full Backfill estimate',
    '',
    'How long a Backfill of the whole Seed List takes as the pipeline runs it (#9): one company at a time, every ' +
      'Candidate that passes the name check gets a relevance call and the relevant ones a sentiment call, sequentially.',
    '',
    `Candidates per company come from a real sample (\`backend/test/fixtures/validation/candidate-volume.json\`, ` +
      `recorded ${day(backfill.volumeRecordedAt)}): ${backfill.sampleRule}. Mean articles found per company and edition: ` +
      `${perEdition}; ${volume.cappedSearches} of ${volume.searches} searches hit Google News' 100-result cap, so heavily ` +
      'covered companies are undercounted and the figures below are a floor for them.',
    '',
    '| Input | value |',
    '|---|---:|',
    `| Tracked Companies | ${assumed.companies} |`,
    `| News Editions | ${assumed.editions} |`,
    `| Candidates per company (distinct across editions) | ${volume.meanCandidatesPerCompany.toFixed(1)} |`,
    `| …passing the name check (classified) | ${assumed.classifiedPerCompany.toFixed(1)} |`,
    `| Share judged relevant (gets a sentiment call), from this run | ${percent(assumed.relevantShare)} |`,
    `| Relevance call, median / p95 | ${seconds(assumed.relevance.medianMs)} / ${seconds(assumed.relevance.p95Ms)} |`,
    `| Sentiment call, median / p95 | ${seconds(assumed.sentiment.medianMs)} / ${seconds(assumed.sentiment.p95Ms)} |`,
    '',
    '| Result | value |',
    '|---|---:|',
    `| Classified Candidates | ${estimate.classifiedCandidates} |`,
    `| Relevance calls + sentiment calls | ${estimate.relevanceCalls} + ${estimate.sentimentCalls} |`,
    `| **Classification time at median latency** | **${hours(estimate.classificationMedianMs)}** |`,
    `| Classification time if every call took the p95 | ${hours(estimate.classificationP95Ms)} |`,
    `| Google News requests (searches + 2 per article for the publisher URL) | ${estimate.newsRequests} |`,
    `| News Source floor at ${assumed.newsRequestIntervalMs} ms between requests | ${hours(estimate.newsSourceMinMs)} |`,
    `| **Total, classification at median + News Source floor** | **${hours(estimate.classificationMedianMs + estimate.newsSourceMinMs)}** |`,
    '',
    `The relevant share comes from this run, and the set is weighted toward ambiguous names, so it is only indicative: ` +
      `with no Candidate relevant classification would take ${hours(onlyRelevance)}, with every one relevant ` +
      `${hours(everySentiment)} (median latency).`,
    '',
    'The Run fetches and classifies one company after the other, so the two times add up. The sample\'s window is a ' +
      'fixed quarter (Q3 2026) rather than the rolling 90 days, which is the same length to within two days.',
    '',
  ];
}

/** `docs/validation-report.md`: what was measured, on what, and when. */
export function renderValidationReport(input: ReportInput): string {
  return [
    '# Classifier validation report',
    '',
    '_Generated by `npm run eval:classifiers` (backend). Do not edit by hand; re-run it instead._',
    '',
    '| | |',
    '|---|---|',
    `| Date | ${day(input.ranAt)} |`,
    `| Model | \`${input.model}\` (Ollama) |`,
    `| Prompt versions | relevance \`${input.promptVersions.relevance}\`, sentiment \`${input.promptVersions.sentiment}\` |`,
    `| Validation set | ${input.items.length} real Google News Candidates, \`backend/test/fixtures/validation/validation-set.json\` |`,
    `| Labels | ${input.quality === null ? 'pending' : `${input.quality.labelled} labelled`} (\`${input.labelsPath}\`) |`,
    '',
    '## Validation set',
    '',
    'Real Candidates from recorded Google News searches (ADR-006) for Seed List companies, deliberately weighted toward ' +
      'names that are ordinary words or first names, with Hebrew-edition items and a few clear-cut names for contrast. ' +
      'Only Candidates the pipeline would classify are included: inside the search window and passing the name check.',
    '',
    ...compositionTable(input.items),
    '',
    `Companies: ${companiesLine(input.items)}.`,
    '',
    ...qualitySection(input),
    ...latencySection(input),
    ...backfillSection(input),
  ].join('\n');
}
