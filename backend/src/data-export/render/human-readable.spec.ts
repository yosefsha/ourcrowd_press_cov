import { EXPORT_SCENARIO } from '../../../test/fixtures/export-scenario';
import { MORPHISEC_AI_TRUST, ZUTACORE_DCD_OPTIONS } from '../../../test/fixtures/recorded-google-news';
import type { Snapshot } from '../export-format';
import { mentionStatusReport, mentionsCsv } from './human-readable';

const TIME_ZONE = 'Asia/Jerusalem';
const EXPORTED_AT = new Date('2026-10-07T09:00:00.000Z');

describe('mentionStatusReport', () => {
  it('lists every company by display name with its Mention Status and counts', () => {
    const report = mentionStatusReport(EXPORT_SCENARIO, EXPORTED_AT, TIME_ZONE);

    expect(report.exportedAt).toBe('2026-10-07T09:00:00.000Z');
    expect(report.timeZone).toBe(TIME_ZONE);
    expect(report.companies.map((company) => [company.displayName, company.mentionStatus])).toEqual([
      ['Harvey', 'no_coverage'],
      ['Morphisec', 'active'],
      ['OncoHost', 'quiet'],
      ['ZutaCore', 'active'],
    ]);
    expect(report.companies[3]).toEqual({
      companyId: 1,
      displayName: 'ZutaCore',
      sourceName: 'ZutaCore',
      companyStatus: 'active',
      mentionStatus: 'active',
      lastMentionedAt: '2026-09-30T14:04:28.000000Z',
      mentions: 2,
      sentiment: { positive: 2, negative: 0, neutral: 0 },
      rejectedCandidates: 1,
      pendingCandidates: 0,
      coverageCapped: false,
    });
    expect(report.companies[1]).toMatchObject({ pendingCandidates: 1, coverageCapped: true, mentions: 1 });
    expect(report.companies[0]).toMatchObject({ companyStatus: 'needs_review', lastMentionedAt: null, mentions: 0 });
  });

  it('turns Active into Recent after 7 days, and keeps Quiet with no upper bound', () => {
    const in20Days = mentionStatusReport(EXPORT_SCENARIO, new Date('2026-10-20T09:00:00.000Z'), TIME_ZONE);
    const inTenYears = mentionStatusReport(EXPORT_SCENARIO, new Date('2036-10-20T09:00:00.000Z'), TIME_ZONE);

    expect(in20Days.companies.find((company) => company.displayName === 'ZutaCore')?.mentionStatus).toBe('recent');
    expect(inTenYears.companies.map((company) => company.mentionStatus)).toEqual([
      'no_coverage',
      'quiet',
      'quiet',
      'quiet',
    ]);
  });

  it('never counts a rejected or pending Candidate as a Mention', () => {
    const onlyRejected: Snapshot = {
      ...EXPORT_SCENARIO,
      candidates: EXPORT_SCENARIO.candidates.filter((candidate) => candidate.relevance !== 'relevant'),
      alertDigests: [],
    };

    const report = mentionStatusReport(onlyRejected, EXPORTED_AT, TIME_ZONE);

    expect(report.companies.every((company) => company.mentionStatus === 'no_coverage')).toBe(true);
  });
});

describe('mentionsCsv', () => {
  it('writes one row per Mention by company, newest first, with the local publication date', () => {
    const lines = mentionsCsv(EXPORT_SCENARIO, TIME_ZONE).slice(1).split('\r\n');

    expect(lines).toEqual([
      'company,date,outlet,title,url,sentiment',
      `Morphisec,2026-09-30,Morphisec,Aligning AI Speed with AI Trust: AI Agent Security Insights for CISOs and Security Leaders,${MORPHISEC_AI_TRUST.googleUrl},neutral`,
      expect.stringMatching(/^OncoHost,2023-05-16,ice \(אייס\),"האם התרופה לסרטן תצא מישראל\? ""תרופות ב-60 מיליארד דולר בשנה""",https:\/\/news\.google\.com\/.+,positive$/),
      `ZutaCore,2026-09-30,Data Center Dynamics,ZutaCore partners with Options Technology to offer liquid cooling to financial services,${ZUTACORE_DCD_OPTIONS.googleUrl},positive`,
      expect.stringMatching(/^ZutaCore,2026-06-02,SiliconANGLE,ZutaCore raises \$100M to scale up waterless cooling for AI data centers,https:\/\/news\.google\.com\/.+,positive$/),
      '',
    ]);
  });

  it('prefers the publisher URL, counts the date in the configured zone and neutralises formulas', () => {
    const [company] = EXPORT_SCENARIO.companies;
    const [article] = EXPORT_SCENARIO.articles;
    const [candidate] = EXPORT_SCENARIO.candidates;
    const snapshot: Snapshot = {
      ...EXPORT_SCENARIO,
      companies: [{ ...company, profile: { ...company.profile, displayName: '=cmd' } }],
      articles: [
        { ...article, publisherUrl: 'https://siliconangle.com/a', publishedAt: '2026-06-01T22:30:00.000000Z' },
      ],
      candidates: [candidate],
    };

    const [, row] = mentionsCsv(snapshot, TIME_ZONE).split('\r\n');

    expect(row).toBe(
      "'=cmd,2026-06-02,SiliconANGLE,ZutaCore raises $100M to scale up waterless cooling for AI data centers,https://siliconangle.com/a,positive",
    );
  });

  it('leaves the sentiment cell empty for a Mention whose sentiment is not judged yet', () => {
    const [candidate] = EXPORT_SCENARIO.candidates;
    const snapshot: Snapshot = {
      ...EXPORT_SCENARIO,
      candidates: [{ ...candidate, sentiment: null, sentimentReason: null, sentimentClassifiedAt: null }],
    };

    const [, row] = mentionsCsv(snapshot, TIME_ZONE).split('\r\n');

    expect(row.endsWith(',')).toBe(true);
  });
});
