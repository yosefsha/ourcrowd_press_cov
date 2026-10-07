import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import { ClassifierUnavailable } from '../classifier-errors';
import { RecordedAmbiguityTriage } from './recorded-ambiguity.triage';
import { RecordedRelevanceClassifier } from './recorded-relevance.classifier';
import { RecordedSentimentClassifier } from './recorded-sentiment.classifier';
import { parseArticlesToRecord, recordVerdicts } from './record-verdicts';
import { InvalidRecording } from './recorded-verdicts';

/* Explicitly listed verdicts stand in for the real model to test the recording flow. */
const COMPANY: CompanyProfile = { displayName: 'Wave', aliases: [], domain: null, description: null, searchTerms: [] };

function article(title: string): ClassifiableArticle {
  return { title, snippet: '', outletName: 'Outlet', publishedAt: new Date('2026-09-01T00:00:00.000Z'), language: 'en' };
}

const ABOUT = article('About the company');
const UNRELATED = article('Unrelated');

describe('parseArticlesToRecord', () => {
  it('reads companies with their articles', () => {
    const json: unknown = JSON.parse(JSON.stringify({ companies: [{ profile: COMPANY, articles: [ABOUT] }] }));

    expect(parseArticlesToRecord(json, 'in.json')).toEqual({ companies: [{ profile: COMPANY, articles: [ABOUT] }] });
  });

  it('rejects a malformed article', () => {
    const json = { companies: [{ profile: COMPANY, articles: [{ title: 'no date' }] }] };

    expect(() => parseArticlesToRecord(json, 'in.json')).toThrow(InvalidRecording);
  });

  it('rejects input without companies', () => {
    expect(() => parseArticlesToRecord([], 'in.json')).toThrow('expected { "companies": [...] }');
  });
});

describe('recordVerdicts', () => {
  const classifiers = {
    relevance: new RecordedRelevanceClassifier([
      { company: COMPANY, article: ABOUT, verdict: { relevant: true, reason: 'About it' } },
      { company: COMPANY, article: UNRELATED, verdict: { relevant: false, reason: 'Weather' } },
    ]),
    sentiment: new RecordedSentimentClassifier([
      { company: COMPANY, article: ABOUT, verdict: { sentiment: 'positive', reason: 'Funding' } },
    ]),
    triage: new RecordedAmbiguityTriage([{ name: 'Wave', assessment: { ambiguous: true, reason: 'Common word' } }]),
  };
  const meta = { model: 'qwen2.5:7b', recordedAt: new Date('2026-10-07T00:00:00.000Z') };

  it('records relevance for every article, sentiment only for relevant ones, triage for every name', async () => {
    const recordings = await recordVerdicts({ companies: [{ profile: COMPANY, articles: [ABOUT, UNRELATED] }] }, ['Wave'], classifiers, meta);

    expect(recordings.relevance).toMatchObject({ kind: 'relevance', model: 'qwen2.5:7b', promptVersion: 'relevance-v1' });
    expect(recordings.relevance.entries.map((entry) => entry.verdict.relevant)).toEqual([true, false]);
    expect(recordings.sentiment).toMatchObject({ kind: 'sentiment', promptVersion: 'sentiment-v1' });
    expect(recordings.sentiment.entries).toEqual([
      { company: COMPANY, article: ABOUT, verdict: { sentiment: 'positive', reason: 'Funding' } },
    ]);
    expect(recordings.ambiguity.entries).toEqual([{ name: 'Wave', assessment: { ambiguous: true, reason: 'Common word' } }]);
  });

  it('aborts on a classifier failure rather than writing a partial recording', async () => {
    const failing = { ...classifiers, triage: { assess: () => Promise.reject(new ClassifierUnavailable('down')) } };

    await expect(recordVerdicts({ companies: [] }, ['Wave'], failing, meta)).rejects.toBeInstanceOf(ClassifierUnavailable);
  });
});
