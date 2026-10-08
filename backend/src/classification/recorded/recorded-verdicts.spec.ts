import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import { NoRecordedVerdict } from './no-recorded-verdict';
import { RecordedAmbiguityTriage } from './recorded-ambiguity.triage';
import { RecordedRelevanceClassifier } from './recorded-relevance.classifier';
import { RecordedSentimentClassifier } from './recorded-sentiment.classifier';
import {
  articleVerdictKey,
  InvalidRecording,
  loadRecording,
  parseRecording,
  type RecordedRelevance,
  type Recording,
  serializeRecording,
} from './recorded-verdicts';

/*
 * The verdicts below are explicitly listed test inputs exercising the replay
 * and file-format mechanics. Tests of consumers should replay the recorded
 * real verdicts in test/fixtures/ollama/ once recorded (ADR-006).
 */
const COMPANY: CompanyProfile = {
  displayName: 'ZutaCore',
  aliases: [],
  domain: 'zutacore.com',
  description: null,
  searchTerms: [],
};

const ARTICLE: ClassifiableArticle = {
  title: 'Title',
  snippet: 'Snippet',
  outletName: 'Outlet',
  publishedAt: new Date('2026-09-01T10:00:00.000Z'),
  language: 'en',
};

const RELEVANCE: Recording<RecordedRelevance> = {
  kind: 'relevance',
  model: 'qwen2.5:7b',
  promptVersion: 'relevance-v1',
  recordedAt: new Date('2026-10-07T08:00:00.000Z'),
  entries: [{ company: COMPANY, article: ARTICLE, verdict: { relevant: true, reason: 'About the company' } }],
};

describe('recordings', () => {
  it('round-trips through its JSON form', () => {
    const json: unknown = JSON.parse(serializeRecording(RELEVANCE));

    expect(parseRecording('relevance', json, 'test')).toEqual(RELEVANCE);
  });

  it('rejects a recording of another kind', () => {
    const json: unknown = JSON.parse(serializeRecording(RELEVANCE));

    expect(() => parseRecording('sentiment', json, 'test')).toThrow('expected kind "sentiment", found "relevance"');
  });

  it('rejects a malformed entry by index', () => {
    const json = { ...(JSON.parse(serializeRecording(RELEVANCE)) as object), entries: [{ company: COMPANY }] };

    expect(() => parseRecording('relevance', json, 'test')).toThrow(InvalidRecording);
    expect(() => parseRecording('relevance', json, 'test')).toThrow('entry 0 is malformed');
  });

  it('rejects a recording without its header', () => {
    expect(() => parseRecording('ambiguity', { kind: 'ambiguity', entries: [] }, 'test')).toThrow(
      'model, promptVersion and recordedAt are required',
    );
  });

  describe('loadRecording', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'recorded-verdicts-'));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('reads a kind from its file', async () => {
      await writeFile(join(dir, 'relevance.json'), serializeRecording(RELEVANCE));

      await expect(loadRecording(dir, 'relevance')).resolves.toEqual(RELEVANCE);
    });

    it('fails loudly, pointing at the recording script, when the file is missing', async () => {
      await expect(loadRecording(dir, 'sentiment')).rejects.toThrow('record it with record-verdicts');
    });

    it('fails on a file that is not JSON', async () => {
      await writeFile(join(dir, 'ambiguity.json'), '{');

      await expect(loadRecording(dir, 'ambiguity')).rejects.toThrow('not valid JSON');
    });
  });
});

describe('in-memory classifiers', () => {
  it('replays a relevance verdict for the same company and article', async () => {
    const classifier = new RecordedRelevanceClassifier(RELEVANCE.entries);

    await expect(classifier.judge(COMPANY, { ...ARTICLE, publishedAt: new Date(ARTICLE.publishedAt) })).resolves.toEqual({
      relevant: true,
      reason: 'About the company',
    });
  });

  it('fails loudly for an article that was not recorded', async () => {
    const classifier = new RecordedRelevanceClassifier(RELEVANCE.entries);

    await expect(classifier.judge(COMPANY, { ...ARTICLE, title: 'Other' })).rejects.toBeInstanceOf(NoRecordedVerdict);
  });

  it('keys an article by company, title, outlet and publication time', () => {
    expect(articleVerdictKey(COMPANY, ARTICLE)).not.toBe(articleVerdictKey({ ...COMPANY, displayName: 'Other' }, ARTICLE));
    expect(articleVerdictKey(COMPANY, ARTICLE)).toBe(articleVerdictKey(COMPANY, { ...ARTICLE, snippet: 'changed' }));
  });

  it('replays a sentiment verdict', async () => {
    const classifier = new RecordedSentimentClassifier([
      { company: COMPANY, article: ARTICLE, verdict: { sentiment: 'neutral', reason: 'Quoted' } },
    ]);

    await expect(classifier.classify(COMPANY, ARTICLE)).resolves.toEqual({ sentiment: 'neutral', reason: 'Quoted' });
    await expect(classifier.classify({ ...COMPANY, displayName: 'X' }, ARTICLE)).rejects.toBeInstanceOf(NoRecordedVerdict);
  });

  it('replays an ambiguity assessment by name, ignoring case and surrounding space', async () => {
    const triage = new RecordedAmbiguityTriage([{ name: 'Wave', assessment: { ambiguous: true, reason: 'Common word' } }]);

    await expect(triage.assess(' wave ')).resolves.toEqual({ ambiguous: true, reason: 'Common word' });
    await expect(triage.assess('ZutaCore')).rejects.toThrow('No recorded verdict for ambiguity of the name "ZutaCore"');
  });
});
