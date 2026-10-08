import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { AmbiguityTriage } from '../ambiguity-triage';
import { AMBIGUITY_PROMPT_VERSION } from '../prompts/ambiguity.prompt';
import { isRecord } from '../prompts/prompt-parts';
import { RELEVANCE_PROMPT_VERSION } from '../prompts/relevance.prompt';
import { SENTIMENT_PROMPT_VERSION } from '../prompts/sentiment.prompt';
import type { RelevanceClassifier } from '../relevance-classifier';
import type { SentimentClassifier } from '../sentiment-classifier';
import {
  InvalidRecording,
  readArticle,
  readCompany,
  type RecordedAmbiguity,
  type RecordedRelevance,
  type RecordedSentiment,
  type Recording,
} from './recorded-verdicts';

/** The real articles to classify, grouped by the company they were found for. */
export interface ArticlesToRecord {
  readonly companies: readonly {
    readonly profile: CompanyProfile;
    readonly articles: readonly ClassifiableArticle[];
  }[];
}

/**
 * Reads the `--articles` input: `{ "companies": [{ "profile": CompanyProfile,
 * "articles": [{ title, snippet, outletName, publishedAt, language }] }] }`,
 * built from the News Source's recorded real feeds.
 */
export function parseArticlesToRecord(json: unknown, source: string): ArticlesToRecord {
  if (!isRecord(json) || !Array.isArray(json.companies)) {
    throw new InvalidRecording(source, 'expected { "companies": [...] }');
  }
  const companies = json.companies.map((entry: unknown, index: number) => {
    const profile = isRecord(entry) ? readCompany(entry.profile) : undefined;
    const articles = isRecord(entry) && Array.isArray(entry.articles) ? entry.articles.map(readArticle) : undefined;
    if (profile === undefined || articles === undefined || articles.some((article) => article === undefined)) {
      throw new InvalidRecording(source, `company ${index} is malformed`);
    }
    return { profile, articles: articles as ClassifiableArticle[] };
  });
  return { companies };
}

export interface Classifiers {
  readonly relevance: RelevanceClassifier;
  readonly sentiment: SentimentClassifier;
  readonly triage: AmbiguityTriage;
}

export interface Recordings {
  readonly relevance: Recording<RecordedRelevance>;
  readonly sentiment: Recording<RecordedSentiment>;
  readonly ambiguity: Recording<RecordedAmbiguity>;
}

/**
 * Asks the real classifiers about every article and name, the way the pipeline
 * does: relevance for every article, sentiment only for those judged relevant
 * (ADR-002), triage for every company name. Any classifier error aborts the
 * recording — a partial fixture would silently drop the hard cases.
 */
export async function recordVerdicts(
  articles: ArticlesToRecord,
  names: readonly string[],
  classifiers: Classifiers,
  meta: { readonly model: string; readonly recordedAt: Date },
): Promise<Recordings> {
  const pairs = articles.companies.flatMap(({ profile, articles: list }) =>
    list.map((article) => ({ company: profile, article })),
  );
  const relevance = await Promise.all(
    pairs.map(async ({ company, article }) => ({
      company,
      article,
      verdict: await classifiers.relevance.judge(company, article),
    })),
  );
  const sentiment = await Promise.all(
    relevance
      .filter((entry) => entry.verdict.relevant)
      .map(async ({ company, article }) => ({
        company,
        article,
        verdict: await classifiers.sentiment.classify(company, article),
      })),
  );
  const ambiguity = await Promise.all(
    names.map(async (name) => ({ name, assessment: await classifiers.triage.assess(name) })),
  );
  const header = { model: meta.model, recordedAt: meta.recordedAt };
  return {
    relevance: { ...header, kind: 'relevance', promptVersion: RELEVANCE_PROMPT_VERSION, entries: relevance },
    sentiment: { ...header, kind: 'sentiment', promptVersion: SENTIMENT_PROMPT_VERSION, entries: sentiment },
    ambiguity: { ...header, kind: 'ambiguity', promptVersion: AMBIGUITY_PROMPT_VERSION, entries: ambiguity },
  };
}
