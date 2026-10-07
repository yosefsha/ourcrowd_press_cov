import type { FoundArticle } from '../../src/domain/article';
import type { ArticleRecord, CandidateRecord, Snapshot } from '../../src/data-export/export-format';
import {
  MORPHISEC_AI_TRUST,
  MORPHISEC_ROGUEPLANET,
  ONCOHOST_B7NET,
  ONCOHOST_ICE,
  ZUTACORE_ALLEYWATCH,
  ZUTACORE_DCD_OPTIONS,
  ZUTACORE_SILICONANGLE,
} from './recorded-google-news';

/**
 * A small database snapshot built around the recorded Google News articles.
 * The verdicts and sentiments are listed explicitly here (Ollama is not part of
 * these tests); they should switch to #6's recorded classifier verdicts once
 * those fixtures exist.
 */

function articleRecord(id: number, article: FoundArticle, firstFetchedAt: string): ArticleRecord {
  return {
    id,
    googleArticleId: article.googleArticleId,
    title: article.title,
    snippet: article.snippet,
    outletName: article.outletName,
    outletUrl: article.outletUrl,
    googleUrl: article.googleUrl,
    publisherUrl: article.publisherUrl,
    publishedAt: article.publishedAt.toISOString().replace('Z', '000Z'),
    language: article.language,
    edition: article.edition,
    firstFetchedAt,
  };
}

const PENDING: Pick<
  CandidateRecord,
  | 'relevance'
  | 'relevanceMethod'
  | 'relevanceReason'
  | 'relevanceClassifiedAt'
  | 'sentiment'
  | 'sentimentReason'
  | 'sentimentClassifiedAt'
  | 'confirmedInRunId'
  | 'confirmedAt'
> = {
  relevance: 'pending',
  relevanceMethod: null,
  relevanceReason: null,
  relevanceClassifiedAt: null,
  sentiment: null,
  sentimentReason: null,
  sentimentClassifiedAt: null,
  confirmedInRunId: null,
  confirmedAt: null,
};

const BACKFILL_FETCHED = '2026-10-05T06:01:12.345678Z';
const DAILY_1_FETCHED = '2026-10-06T04:00:03.123456Z';
const DAILY_2_FETCHED = '2026-10-07T04:00:02.654321Z';

export const EXPORT_SCENARIO: Snapshot = {
  companies: [
    {
      id: 1,
      sourceName: 'ZutaCore',
      status: 'active',
      reviewReason: null,
      coverageCapped: false,
      profile: {
        displayName: 'ZutaCore',
        aliases: [],
        domain: 'zutacore.com',
        description: 'Waterless two-phase liquid cooling for AI data centers',
        searchTerms: ['"ZutaCore"'],
      },
      createdAt: '2026-10-05T06:00:00.100200Z',
      updatedAt: '2026-10-05T06:00:00.100200Z',
    },
    {
      id: 2,
      sourceName: 'Morphisec',
      status: 'active',
      reviewReason: null,
      coverageCapped: true,
      profile: {
        displayName: 'Morphisec',
        aliases: [],
        domain: 'morphisec.com',
        description: 'Automated moving target defense against cyberattacks',
        searchTerms: ['"Morphisec"'],
      },
      createdAt: '2026-10-05T06:00:00.100300Z',
      updatedAt: '2026-10-05T06:00:00.100300Z',
    },
    {
      id: 3,
      sourceName: 'OncoHost',
      status: 'active',
      reviewReason: null,
      coverageCapped: false,
      profile: {
        displayName: 'OncoHost',
        aliases: ['אונקוהוסט'],
        domain: 'oncohost.com',
        description: 'Proteomics-based precision oncology',
        searchTerms: ['"OncoHost"'],
      },
      createdAt: '2026-10-05T06:00:00.100400Z',
      updatedAt: '2026-10-06T09:12:44.000001Z',
    },
    {
      id: 4,
      sourceName: 'Harvey',
      status: 'needs_review',
      reviewReason: 'A common first name and surname; most news about "Harvey" is unrelated',
      coverageCapped: false,
      profile: { displayName: 'Harvey', aliases: [], domain: null, description: null, searchTerms: [] },
      createdAt: '2026-10-05T06:00:00.100500Z',
      updatedAt: '2026-10-05T06:00:00.100500Z',
    },
  ],
  articles: [
    articleRecord(1, ZUTACORE_SILICONANGLE, BACKFILL_FETCHED),
    articleRecord(2, ZUTACORE_ALLEYWATCH, BACKFILL_FETCHED),
    articleRecord(3, ONCOHOST_ICE, BACKFILL_FETCHED),
    articleRecord(4, ONCOHOST_B7NET, BACKFILL_FETCHED),
    articleRecord(5, ZUTACORE_DCD_OPTIONS, DAILY_1_FETCHED),
    articleRecord(6, MORPHISEC_AI_TRUST, DAILY_2_FETCHED),
    articleRecord(7, MORPHISEC_ROGUEPLANET, DAILY_2_FETCHED),
  ],
  candidates: [
    {
      id: 1,
      articleId: 1,
      companyId: 1,
      fetchedInRunId: 1,
      relevance: 'relevant',
      relevanceMethod: 'llm',
      relevanceReason: 'Reports ZutaCore raising a $100M round',
      relevanceClassifiedAt: '2026-10-05T06:03:00.000001Z',
      sentiment: 'positive',
      sentimentReason: 'A large funding round to scale the company',
      sentimentClassifiedAt: '2026-10-05T06:03:05.000002Z',
      confirmedInRunId: 1,
      confirmedAt: '2026-10-05T06:03:05.000002Z',
      createdAt: BACKFILL_FETCHED,
    },
    {
      ...PENDING,
      id: 2,
      articleId: 2,
      companyId: 1,
      fetchedInRunId: 1,
      relevance: 'rejected',
      relevanceMethod: 'llm',
      relevanceReason: 'A roundup of many funding rounds, not about ZutaCore',
      relevanceClassifiedAt: '2026-10-05T06:03:10.500000Z',
      createdAt: BACKFILL_FETCHED,
    },
    {
      id: 3,
      articleId: 3,
      companyId: 3,
      fetchedInRunId: 1,
      relevance: 'relevant',
      relevanceMethod: 'llm',
      relevanceReason: 'Discusses OncoHost among Israeli cancer-drug developers',
      relevanceClassifiedAt: '2026-10-05T06:04:00.000000Z',
      sentiment: 'positive',
      sentimentReason: 'Presents the company as promising',
      sentimentClassifiedAt: '2026-10-05T06:04:02.000000Z',
      confirmedInRunId: 1,
      confirmedAt: '2026-10-05T06:04:02.000000Z',
      createdAt: BACKFILL_FETCHED,
    },
    {
      ...PENDING,
      id: 4,
      articleId: 4,
      companyId: 3,
      fetchedInRunId: 1,
      relevance: 'rejected',
      relevanceMethod: 'name_absent',
      relevanceReason: 'The text never names OncoHost',
      relevanceClassifiedAt: '2026-10-05T06:04:03.000000Z',
      createdAt: BACKFILL_FETCHED,
    },
    {
      id: 5,
      articleId: 5,
      companyId: 1,
      fetchedInRunId: 2,
      relevance: 'relevant',
      relevanceMethod: 'llm',
      relevanceReason: 'Announces a ZutaCore partnership',
      relevanceClassifiedAt: '2026-10-06T04:01:00.000000Z',
      sentiment: 'positive',
      sentimentReason: 'A new commercial partnership',
      sentimentClassifiedAt: '2026-10-06T04:01:04.000000Z',
      confirmedInRunId: 2,
      confirmedAt: '2026-10-06T04:01:04.000000Z',
      createdAt: DAILY_1_FETCHED,
    },
    {
      id: 6,
      articleId: 6,
      companyId: 2,
      fetchedInRunId: 3,
      relevance: 'relevant',
      relevanceMethod: 'llm',
      relevanceReason: 'Published by Morphisec about its own research',
      relevanceClassifiedAt: '2026-10-07T04:01:00.000000Z',
      sentiment: 'neutral',
      sentimentReason: 'Informational piece',
      sentimentClassifiedAt: '2026-10-07T04:01:03.000000Z',
      confirmedInRunId: 3,
      confirmedAt: '2026-10-07T04:01:03.000000Z',
      createdAt: DAILY_2_FETCHED,
    },
    { ...PENDING, id: 7, articleId: 7, companyId: 2, fetchedInRunId: 3, createdAt: DAILY_2_FETCHED },
  ],
  runs: [
    {
      id: 1,
      type: 'backfill',
      status: 'completed_with_errors',
      trigger: 'dashboard',
      params: { until: null, companyIds: null, reprocess: false },
      progress: {
        companiesTotal: 3,
        companiesDone: 3,
        candidatesFound: 4,
        candidatesClassified: 4,
        mentionsConfirmed: 2,
        companyErrors: 1,
        currentCompany: null,
      },
      error: null,
      createdAt: '2026-10-05T06:00:59.999999Z',
      startedAt: '2026-10-05T06:01:00.000000Z',
      finishedAt: '2026-10-05T06:05:00.000000Z',
      companyErrors: [
        {
          id: 1,
          companyId: 2,
          stage: 'collection',
          message: 'Google News RSS responded with HTTP 503',
          createdAt: '2026-10-05T06:02:00.000000Z',
        },
      ],
    },
    {
      id: 2,
      type: 'daily_check',
      status: 'completed',
      trigger: 'schedule',
      params: { until: null, companyIds: null, reprocess: false },
      progress: {
        companiesTotal: 3,
        companiesDone: 3,
        candidatesFound: 1,
        candidatesClassified: 1,
        mentionsConfirmed: 1,
        companyErrors: 0,
        currentCompany: null,
      },
      error: null,
      createdAt: '2026-10-06T04:00:00.000000Z',
      startedAt: '2026-10-06T04:00:01.000000Z',
      finishedAt: '2026-10-06T04:02:00.000000Z',
      companyErrors: [],
    },
    {
      id: 3,
      type: 'daily_check',
      status: 'completed',
      trigger: 'schedule',
      params: { until: '2026-10-07', companyIds: [2], reprocess: false },
      progress: null,
      error: null,
      createdAt: '2026-10-07T04:00:00.000000Z',
      startedAt: '2026-10-07T04:00:01.000000Z',
      finishedAt: '2026-10-07T04:02:00.000000Z',
      companyErrors: [],
    },
  ],
  alertDigests: [
    {
      id: 1,
      runId: 2,
      createdAt: '2026-10-06T04:02:00.000000Z',
      acknowledgedAt: '2026-10-06T08:30:00.000000Z',
      candidateIds: [5],
    },
    { id: 2, runId: 3, createdAt: '2026-10-07T04:02:00.000000Z', acknowledgedAt: null, candidateIds: [6] },
  ],
};
