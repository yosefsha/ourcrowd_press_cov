import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { InvalidCandidateVolume, parseCandidateVolume, serializeCandidateVolume, summarizeVolume } from './candidate-volume';

const RECORDED = join(__dirname, '..', '..', '..', 'test', 'fixtures', 'validation', 'candidate-volume.json');

const SAMPLE = {
  recordedAt: '2026-10-08T00:00:00.000Z',
  window: { from: '2026-07-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' },
  sampleRule: 'two companies',
  companies: [
    { company: 'A', editions: [{ edition: 'en-US', found: 10, capped: false }, { edition: 'he-IL', found: 2, capped: false }], candidates: 11, classified: 8 },
    { company: 'B', editions: [{ edition: 'en-US', found: 100, capped: true }, { edition: 'he-IL', found: 0, capped: false }], candidates: 100, classified: 90 },
  ],
};

describe('candidate volume sample', () => {
  it('summarizes means per company and counts capped searches', () => {
    const summary = summarizeVolume(parseCandidateVolume(SAMPLE, 'sample.json'));

    expect(summary).toEqual({
      sampledCompanies: 2,
      meanCandidatesPerCompany: 55.5,
      meanClassifiedPerCompany: 49,
      meanFoundPerEdition: { 'en-US': 55, 'he-IL': 1 },
      cappedSearches: 1,
      searches: 4,
    });
  });

  it('round-trips through its JSON form', () => {
    const sample = parseCandidateVolume(SAMPLE, 'sample.json');

    expect(parseCandidateVolume(JSON.parse(serializeCandidateVolume(sample)), 'again.json')).toEqual(sample);
  });

  it.each([
    ['a non-object', []],
    ['a missing window', { ...SAMPLE, window: undefined }],
    ['no companies', { ...SAMPLE, companies: [] }],
    ['a negative count', { ...SAMPLE, companies: [{ ...SAMPLE.companies[0], classified: -1 }] }],
  ])('rejects %s', (_case, json) => {
    expect(() => parseCandidateVolume(json, 'bad.json')).toThrow(InvalidCandidateVolume);
  });

  it('reads the recorded sample', () => {
    const sample = parseCandidateVolume(JSON.parse(readFileSync(RECORDED, 'utf8')), RECORDED);

    expect(sample.companies.length).toBeGreaterThan(0);
    for (const company of sample.companies) {
      expect(company.classified).toBeLessThanOrEqual(company.candidates);
    }
  });
});
