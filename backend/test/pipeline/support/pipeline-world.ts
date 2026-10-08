import type { TrackedCompany } from '../../../src/domain/company';
import { parseNewsEditions } from '../../../src/domain/news-edition';
import type { Run, RunParams, RunType } from '../../../src/domain/run';
import { BackfillExecutor } from '../../../src/pipeline/backfill.executor';
import type { CandidateRepository } from '../../../src/pipeline/candidate.repository';
import { CompanyCollectionService, type PipelineCompanies } from '../../../src/pipeline/company-collection.service';
import { DailyCheckExecutor } from '../../../src/pipeline/daily-check.executor';
import type { PipelineSettings } from '../../../src/pipeline/pipeline-settings';
import type { RunHistory } from '../../../src/pipeline/run-history';
import {
  FixedClock,
  InMemoryCandidateRepository,
  InMemoryPipelineCompanies,
  InMemoryRunHistory,
  RecordingDigestBuilder,
  trackedCompany,
} from './in-memory-pipeline-ports';
import { RecordedNewsSource } from './recorded-news';
import { RecordedClassifiers } from './recorded-classifiers';

export const CEREBRAS = trackedCompany(1, { displayName: 'Cerebras' });
export const GROQ = trackedCompany(2, { displayName: 'Groq' });
/** The Hebrew alias is a curated profile edit: Hebrew outlets write the name in Hebrew script. */
export const INNOVIZ = trackedCompany(3, { displayName: 'Innoviz', aliases: ['אינוויז'] });
export const ARBE_NEEDS_REVIEW = trackedCompany(4, { displayName: 'Arbe Robotics' }, 'needs_review');
export const HAILO_DEACTIVATED = trackedCompany(5, { displayName: 'Hailo' }, 'deactivated');

export const FIXTURE_COMPANIES: readonly TrackedCompany[] = [CEREBRAS, GROQ, INNOVIZ, ARBE_NEEDS_REVIEW, HAILO_DEACTIVATED];

/** Shortly after the last recorded Article: every recording lies inside the Coverage Window. */
export const AFTER_RECORDINGS = new Date('2026-07-31T12:00:00Z');

export const SETTINGS: PipelineSettings = {
  editions: parseNewsEditions('en-US,he-IL'),
  maxCandidatesPerCompany: null,
  classifierFailureThreshold: 5,
  timeZone: 'Asia/Jerusalem',
};

export interface PipelineWorld {
  readonly news: RecordedNewsSource;
  readonly classifiers: RecordedClassifiers;
  readonly companies: PipelineCompanies;
  readonly candidates: CandidateRepository;
  readonly history: RunHistory;
  readonly digests: RecordingDigestBuilder;
  readonly clock: FixedClock;
  readonly backfill: BackfillExecutor;
  readonly dailyCheck: DailyCheckExecutor;
}

export interface WorldOptions {
  readonly news?: RecordedNewsSource;
  readonly companies?: PipelineCompanies;
  readonly candidates?: CandidateRepository;
  readonly history?: RunHistory;
  readonly settings?: Partial<PipelineSettings>;
}

/** Both executors over the recorded fixtures and in-memory ports, unless others are given. */
export function pipelineWorld(options: WorldOptions = {}): PipelineWorld {
  const news = options.news ?? new RecordedNewsSource();
  const classifiers = new RecordedClassifiers();
  const companies = options.companies ?? new InMemoryPipelineCompanies(FIXTURE_COMPANIES);
  const candidates = options.candidates ?? new InMemoryCandidateRepository();
  const history = options.history ?? new InMemoryRunHistory();
  const digests = new RecordingDigestBuilder();
  const clock = new FixedClock(AFTER_RECORDINGS);
  const settings = { ...SETTINGS, ...options.settings };
  const collection = new CompanyCollectionService(
    news,
    classifiers.relevance,
    classifiers.sentiment,
    companies,
    candidates,
    settings,
  );
  return {
    news,
    classifiers,
    companies,
    candidates,
    history,
    digests,
    clock,
    backfill: new BackfillExecutor(collection, settings, clock),
    dailyCheck: new DailyCheckExecutor(collection, history, digests, settings, clock),
  };
}

/** The signal of a collector that is not shutting down. */
export const RUNNING: AbortSignal = new AbortController().signal;

/** The signal of a collector that has begun shutting down. */
export function shuttingDown(): AbortSignal {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

/** A claimed Run, as the worker hands it to an executor. */
export function claimedRun(id: number, type: RunType, params: Partial<RunParams> = {}): Run {
  return {
    id,
    type,
    trigger: 'dashboard',
    params: { until: null, companyIds: null, reprocess: false, ...params },
    status: 'running',
    progress: null,
    error: null,
    createdAt: AFTER_RECORDINGS,
    startedAt: AFTER_RECORDINGS,
    finishedAt: null,
  };
}
