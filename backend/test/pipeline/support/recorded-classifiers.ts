import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ClassifierOutputInvalid, ClassifierUnavailable } from '../../../src/classification/classifier-errors';
import { RecordedRelevanceClassifier } from '../../../src/classification/recorded/recorded-relevance.classifier';
import { RecordedSentimentClassifier } from '../../../src/classification/recorded/recorded-sentiment.classifier';
import { parseRecording, recordingFileName, type RecordingKind } from '../../../src/classification/recorded/recorded-verdicts';
import type { RelevanceClassifier } from '../../../src/classification/relevance-classifier';
import type { SentimentClassifier } from '../../../src/classification/sentiment-classifier';
import type { ClassifiableArticle } from '../../../src/domain/article';
import type { CompanyProfile } from '../../../src/domain/company';
import type { RelevanceVerdict } from '../../../src/domain/relevance';
import type { Sentiment, SentimentVerdict } from '../../../src/domain/sentiment';

/**
 * Real `qwen2.5:7b` verdicts (prompt versions `relevance-v1` / `sentiment-v1`)
 * for every recorded fixture Article, recorded on 2026-10-08 with #6's
 * `record-verdicts` CLI against the Articles in `google-news-recorded.json`.
 */
const OLLAMA_FIXTURES = join(__dirname, '..', 'fixtures', 'ollama');

function loadEntries<K extends RecordingKind>(kind: K): ReturnType<typeof parseRecording<K>>['entries'] {
  const path = join(OLLAMA_FIXTURES, recordingFileName(kind));
  return parseRecording(kind, JSON.parse(readFileSync(path, 'utf8')) as unknown, path).entries;
}

/**
 * A verdict listed by hand in a test, for a case the recorded model verdicts
 * do not produce. Kept to the minimum; each use says why.
 */
export interface HandListedMention {
  readonly company: string;
  readonly title: string;
  readonly sentiment: Sentiment;
}

/** What the classifiers do instead of answering. */
export type ClassifierFault = 'unavailable' | 'invalid_output';

function key(company: string, title: string): string {
  return `${company}|${title}`;
}

/**
 * The recorded classifiers, with failures injected on demand and every call
 * recorded — the in-memory stand-in for Ollama in the pipeline tests.
 */
export class RecordedClassifiers {
  readonly relevanceCalls: string[] = [];
  readonly sentimentCalls: string[] = [];
  private readonly recordedRelevance = new RecordedRelevanceClassifier(loadEntries('relevance'));
  private readonly recordedSentiment = new RecordedSentimentClassifier(loadEntries('sentiment'));
  private readonly handListed = new Map<string, HandListedMention>();
  private relevanceFaults: (ClassifierFault | null)[] = [];
  private sentimentFaults: (ClassifierFault | null)[] = [];
  private alwaysFault: ClassifierFault | null = null;

  /** Answers this (company, title) as a Mention, overriding the recorded verdict. */
  handList(mention: HandListedMention): this {
    this.handListed.set(key(mention.company, mention.title), mention);
    return this;
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
      if (this.handListed.has(key(company.displayName, article.title))) {
        return Promise.resolve({ relevant: true, reason: 'Hand-listed in the test.' });
      }
      return this.recordedRelevance.judge(company, article);
    },
  };

  readonly sentiment: SentimentClassifier = {
    classify: (company: CompanyProfile, article: ClassifiableArticle): Promise<SentimentVerdict> => {
      this.sentimentCalls.push(key(company.displayName, article.title));
      const fault = this.alwaysFault ?? this.sentimentFaults.shift() ?? null;
      if (fault !== null) return Promise.reject(faultError(fault));
      const listed = this.handListed.get(key(company.displayName, article.title));
      if (listed !== undefined) return Promise.resolve({ sentiment: listed.sentiment, reason: 'Hand-listed in the test.' });
      return this.recordedSentiment.classify(company, article);
    },
  };
}

function faultError(fault: ClassifierFault): Error {
  return fault === 'unavailable'
    ? new ClassifierUnavailable('connect ECONNREFUSED 127.0.0.1:11434')
    : new ClassifierOutputInvalid('The answer is not a JSON verdict', 'Sure! Here is my analysis…');
}
