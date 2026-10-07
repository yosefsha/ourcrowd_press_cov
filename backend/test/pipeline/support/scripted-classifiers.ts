import { ClassifierOutputInvalid, ClassifierUnavailable } from '../../../src/classification/classifier-errors';
import type { RelevanceClassifier } from '../../../src/classification/relevance-classifier';
import type { SentimentClassifier } from '../../../src/classification/sentiment-classifier';
import type { ClassifiableArticle } from '../../../src/domain/article';
import type { CompanyProfile } from '../../../src/domain/company';
import type { RelevanceVerdict } from '../../../src/domain/relevance';
import type { Sentiment, SentimentVerdict } from '../../../src/domain/sentiment';

/** An explicit verdict for one (company, Article title): a Mention with its Sentiment, or a rejection. */
export type ScriptedVerdict =
  | { readonly company: string; readonly title: string; readonly sentiment: Sentiment }
  | { readonly company: string; readonly title: string; readonly rejected: string };

/** What the in-memory classifiers do instead of answering. */
export type ClassifierFault = 'unavailable' | 'invalid_output';

function key(company: string, title: string): string {
  return `${company}|${title}`;
}

/**
 * In-memory Relevance and Sentiment classifiers answering from explicit
 * verdicts, keyed by company and Article title. Until #6's recorded Ollama
 * verdicts exist, the verdicts are listed by the tests themselves.
 */
export class ScriptedClassifiers {
  readonly relevanceCalls: string[] = [];
  readonly sentimentCalls: string[] = [];
  private readonly verdicts = new Map<string, ScriptedVerdict>();
  private relevanceFaults: (ClassifierFault | null)[] = [];
  private sentimentFaults: (ClassifierFault | null)[] = [];
  private alwaysFault: ClassifierFault | null = null;

  constructor(verdicts: readonly ScriptedVerdict[]) {
    for (const verdict of verdicts) this.verdicts.set(key(verdict.company, verdict.title), verdict);
  }

  /** The next calls fail in this order; `null` answers normally. */
  failRelevance(...faults: (ClassifierFault | null)[]): this {
    this.relevanceFaults = faults;
    return this;
  }

  failSentiment(...faults: (ClassifierFault | null)[]): this {
    this.sentimentFaults = faults;
    return this;
  }

  /** Every call fails until `recover()`. */
  goDown(fault: ClassifierFault = 'unavailable'): this {
    this.alwaysFault = fault;
    return this;
  }

  recover(): this {
    this.alwaysFault = null;
    this.relevanceFaults = [];
    this.sentimentFaults = [];
    return this;
  }

  readonly relevance: RelevanceClassifier = {
    judge: (company: CompanyProfile, article: ClassifiableArticle): Promise<RelevanceVerdict> => {
      this.relevanceCalls.push(key(company.displayName, article.title));
      const fault = this.alwaysFault ?? this.relevanceFaults.shift() ?? null;
      if (fault !== null) return Promise.reject(faultError(fault));
      const verdict = this.verdictFor(company, article);
      return Promise.resolve(
        'rejected' in verdict
          ? { relevant: false, reason: verdict.rejected }
          : { relevant: true, reason: `The article is about ${company.displayName}.` },
      );
    },
  };

  readonly sentiment: SentimentClassifier = {
    classify: (company: CompanyProfile, article: ClassifiableArticle): Promise<SentimentVerdict> => {
      this.sentimentCalls.push(key(company.displayName, article.title));
      const fault = this.alwaysFault ?? this.sentimentFaults.shift() ?? null;
      if (fault !== null) return Promise.reject(faultError(fault));
      const verdict = this.verdictFor(company, article);
      if ('rejected' in verdict) throw new Error(`Sentiment asked for a rejected Candidate: ${article.title}`);
      return Promise.resolve({ sentiment: verdict.sentiment, reason: `Scripted ${verdict.sentiment} verdict.` });
    },
  };

  private verdictFor(company: CompanyProfile, article: ClassifiableArticle): ScriptedVerdict {
    const verdict = this.verdicts.get(key(company.displayName, article.title));
    if (verdict === undefined) {
      throw new Error(`No scripted verdict for ${company.displayName} / "${article.title}"`);
    }
    return verdict;
  }
}

function faultError(fault: ClassifierFault): Error {
  return fault === 'unavailable'
    ? new ClassifierUnavailable('connect ECONNREFUSED 127.0.0.1:11434')
    : new ClassifierOutputInvalid('The answer is not a JSON verdict', 'Sure! Here is my analysis…');
}
