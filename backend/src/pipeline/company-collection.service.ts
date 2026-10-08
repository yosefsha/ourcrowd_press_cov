import { Inject, Injectable } from '@nestjs/common';

import { ClassifierOutputInvalid, ClassifierUnavailable } from '../classification/classifier-errors';
import { RELEVANCE_CLASSIFIER, type RelevanceClassifier } from '../classification/relevance-classifier';
import { SENTIMENT_CLASSIFIER, type SentimentClassifier } from '../classification/sentiment-classifier';
import { TRACKED_COMPANY_REPOSITORY, type TrackedCompanyRepository } from '../companies/tracked-company.repository';
import type { FoundArticle } from '../domain/article';
import type { TrackedCompany } from '../domain/company';
import type { DateRange } from '../domain/date-range';
import type { RunOutcome, RunStage } from '../domain/run';
import { NEWS_SOURCE, type NewsSource, NewsSourceUnavailable } from '../news/news-source';
import { RunInterrupted, type RunProgressReporter } from '../runs/run-executor';
import { selectArticles } from './article-selection';
import { CANDIDATE_REPOSITORY, type CandidateRepository, type PendingCandidate } from './candidate.repository';
import { namesCompany } from './name-check';
import { PIPELINE_SETTINGS, type PipelineSettings } from './pipeline-settings';
import { RunTally } from './run-tally';

/** The Relevance reason stored for a Candidate rejected by the name check. */
export const NAME_ABSENT_REASON = 'Neither the title nor the snippet names the company or any of its aliases.';

/**
 * When a collection records `coverage_capped` on the company: a Backfill sees
 * the whole Coverage Window and records either way; a Daily Check sees a few
 * days only, so it can raise the flag but never clear it.
 */
export type CoverageCappedPolicy = 'record_always' | 'record_when_capped';

/** What one Run collects: which period, for which companies, and how it reports caps. */
export interface CollectionPlan {
  readonly runId: number;
  readonly window: DateRange;
  readonly companies: readonly TrackedCompany[];
  readonly coverageCapped: CoverageCappedPolicy;
}

/** The part of the company repository the pipeline uses. */
export type PipelineCompanies = Pick<TrackedCompanyRepository, 'list' | 'recordCoverageCapped'>;

/** Stops the Run: the classifier failed too many times in a row. */
class ClassifierFailureThresholdReached extends Error {
  constructor(threshold: number, cause: ClassifierUnavailable) {
    super(`The classifier was unavailable for ${threshold} consecutive Candidates: ${cause.message}`, { cause });
    this.name = 'ClassifierFailureThresholdReached';
  }
}

/** Per-execution state of the classifier failure streak. */
interface FailureStreak {
  consecutive: number;
}

/**
 * The work shared by the Backfill and the Daily Check: for one company at a
 * time, fetch → de-duplicate → name check → relevance → sentiment, against
 * ports only (ADR-002, ADR-008).
 */
@Injectable()
export class CompanyCollectionService {
  constructor(
    @Inject(NEWS_SOURCE) private readonly newsSource: NewsSource,
    @Inject(RELEVANCE_CLASSIFIER) private readonly relevanceClassifier: RelevanceClassifier,
    @Inject(SENTIMENT_CLASSIFIER) private readonly sentimentClassifier: SentimentClassifier,
    @Inject(TRACKED_COMPANY_REPOSITORY) private readonly companies: PipelineCompanies,
    @Inject(CANDIDATE_REPOSITORY) private readonly candidates: CandidateRepository,
    @Inject(PIPELINE_SETTINGS) private readonly settings: PipelineSettings,
  ) {}

  /**
   * The Tracked Companies a Run processes: active ones only — never Needs
   * Review or deactivated — restricted to `companyIds` when given.
   */
  async companiesToCollect(companyIds: readonly number[] | null): Promise<readonly TrackedCompany[]> {
    return this.companies.list(
      companyIds === null ? { statuses: ['active'] } : { statuses: ['active'], ids: companyIds },
    );
  }

  /** Re-process: forgets everything collected for the companies, so the Run refetches it. */
  async discardCollected(companies: readonly TrackedCompany[]): Promise<void> {
    for (const company of companies) {
      await this.candidates.discardCompany(company.id);
    }
  }

  /**
   * Runs the plan one company at a time — classifying each company's
   * Candidates `classificationConcurrency` at a time — and reports progress
   * after each step.
   * A News Source failure is recorded against the company and the Run carries
   * on; `classifierFailureThreshold` consecutive `ClassifierUnavailable`s stop
   * it as failed, leaving the remaining Candidates pending for the next Run.
   *
   * When `signal` aborts (collector shutdown) the company in hand is finished
   * and `RunInterrupted` is thrown instead of starting the next one; what was
   * not classified stays pending, so the next Run resumes there.
   */
  async collect(plan: CollectionPlan, progress: RunProgressReporter, signal: AbortSignal): Promise<RunOutcome> {
    const tally = new RunTally(plan.companies.length);
    const streak: FailureStreak = { consecutive: 0 };
    await progress.report(tally.progress());
    for (const company of plan.companies) {
      if (signal.aborted) throw new RunInterrupted(plan.runId);
      tally.startCompany(company.profile.displayName);
      await progress.report(tally.progress());
      await this.fetchCandidates(company, plan, tally);
      await progress.report(tally.progress());
      try {
        await this.classifyPending(company, plan.runId, tally, streak, progress);
      } catch (error) {
        if (error instanceof ClassifierFailureThresholdReached) {
          const outcome = tally.failed(error.message, company.id);
          await progress.report(tally.progress());
          return outcome;
        }
        throw error;
      }
      tally.finishCompany(company.id);
      await progress.report(tally.progress());
    }
    return tally.completed();
  }

  private async fetchCandidates(company: TrackedCompany, plan: CollectionPlan, tally: RunTally): Promise<void> {
    const found: FoundArticle[] = [];
    let sourceCapped = false;
    let complete = true;
    for (const edition of this.settings.editions) {
      try {
        const result = await this.newsSource.findCandidates(company.profile, plan.window, edition);
        found.push(...result.articles);
        sourceCapped ||= result.capped;
      } catch (error) {
        if (!(error instanceof NewsSourceUnavailable)) throw error;
        complete = false;
        tally.companyError({ companyId: company.id, stage: 'collection', message: `${edition.code}: ${error.message}` });
      }
    }
    const selection = selectArticles(found, plan.window, this.settings.maxCandidatesPerCompany);
    await this.candidates.recordFound(company.id, selection.articles, plan.runId);
    tally.found(selection.articles.length);
    const capped = sourceCapped || selection.truncated;
    if (capped || (complete && plan.coverageCapped === 'record_always')) {
      await this.companies.recordCoverageCapped(company.id, capped);
    }
  }

  /**
   * Classifies the company's pending Candidates, `classificationConcurrency` at
   * a time. Once the failure threshold is reached no further Candidate is
   * started; those in flight finish, then the Run stops. Progress reports are
   * chained so each one carries the latest tally and none overtakes another.
   */
  private async classifyPending(
    company: TrackedCompany,
    runId: number,
    tally: RunTally,
    streak: FailureStreak,
    progress: RunProgressReporter,
  ): Promise<void> {
    const pending = await this.candidates.pendingFor(company.id);
    let next = 0;
    const halt: { error: Error | null } = { error: null };
    let reported: Promise<void> = Promise.resolve();
    const worker = async (): Promise<void> => {
      while (halt.error === null && next < pending.length) {
        const candidate = pending[next++];
        try {
          const confirmed = await this.classifyOne(company, candidate, runId, tally, streak);
          if (confirmed !== null) {
            tally.classified(confirmed);
            reported = reported.then(() => progress.report(tally.progress()));
          }
        } catch (error) {
          halt.error ??= error instanceof Error ? error : new Error(String(error));
        }
      }
    };
    const workers = Math.max(1, Math.min(this.settings.classificationConcurrency, pending.length));
    await Promise.all(Array.from({ length: workers }, worker));
    await reported;
    if (halt.error !== null) throw halt.error;
  }

  /** True when confirmed as a Mention, false when rejected, null when left pending. */
  private async classifyOne(
    company: TrackedCompany,
    candidate: PendingCandidate,
    runId: number,
    tally: RunTally,
    streak: FailureStreak,
  ): Promise<boolean | null> {
    if (!namesCompany(company.profile, candidate.article)) {
      await this.candidates.recordRejection(candidate.id, 'name_absent', NAME_ABSENT_REASON);
      return false;
    }
    const relevance = await this.askClassifier('relevance', tally, streak, () =>
      this.relevanceClassifier.judge(company.profile, candidate.article),
    );
    if (relevance === null) return null;
    if (!relevance.relevant) {
      await this.candidates.recordRejection(candidate.id, 'llm', relevance.reason);
      return false;
    }
    const sentiment = await this.askClassifier('sentiment', tally, streak, () =>
      this.sentimentClassifier.classify(company.profile, candidate.article),
    );
    if (sentiment === null) return null;
    await this.candidates.recordMention(candidate.id, relevance.reason, sentiment, runId);
    return true;
  }

  /**
   * Calls a classifier; null when it failed and the Candidate stays pending.
   * Any answer — even an unreadable one — proves the model is reachable and
   * resets the streak; only `ClassifierUnavailable` counts toward the threshold.
   */
  private async askClassifier<T>(
    stage: RunStage,
    tally: RunTally,
    streak: FailureStreak,
    ask: () => Promise<T>,
  ): Promise<T | null> {
    try {
      const answer = await ask();
      streak.consecutive = 0;
      return answer;
    } catch (error) {
      if (error instanceof ClassifierOutputInvalid) {
        streak.consecutive = 0;
        tally.classifierFailed(stage, error.message);
        return null;
      }
      if (error instanceof ClassifierUnavailable) {
        streak.consecutive += 1;
        tally.classifierFailed(stage, error.message);
        if (streak.consecutive >= this.settings.classifierFailureThreshold) {
          throw new ClassifierFailureThresholdReached(this.settings.classifierFailureThreshold, error);
        }
        return null;
      }
      throw error;
    }
  }
}
