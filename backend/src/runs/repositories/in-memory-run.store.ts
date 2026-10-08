import {
  ACTIVE_RUN_STATUSES,
  type Run,
  type RunCompanyError,
  type RunOutcome,
  type RunProgress,
  type RunRequest,
  type RunStatus,
} from '../../domain/run';
import type { RunDetail, RunHistory } from '../run-history';
import { RunAlreadyActive, RunNotFound, type RunQueue } from '../run-queue';

const ACTIVE: readonly RunStatus[] = ACTIVE_RUN_STATUSES;

/** Runs `action`, turning a thrown error into a rejection as an async port would. */
function settle<T>(action: () => T): Promise<T> {
  try {
    return Promise.resolve(action());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * In-memory Run queue and history for tests: the same rules as the Postgres
 * implementation (one active Run, claim oldest first) over a list.
 */
export class InMemoryRunStore implements RunQueue, RunHistory {
  private readonly runs: Run[] = [];
  private readonly companyErrors = new Map<number, RunCompanyError[]>();
  private nextId = 1;

  constructor(
    private readonly companyNames: ReadonlyMap<number, string> = new Map(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  enqueue(request: RunRequest): Promise<Run> {
    const active = this.runs.find((run) => ACTIVE.includes(run.status));
    if (active !== undefined) return Promise.reject(new RunAlreadyActive(active));
    const run: Run = {
      ...request,
      id: this.nextId++,
      status: 'queued',
      progress: null,
      error: null,
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
    };
    this.runs.push(run);
    return Promise.resolve(run);
  }

  claimNext(): Promise<Run | null> {
    const queued = this.runs.find((run) => run.status === 'queued');
    if (queued === undefined) return Promise.resolve(null);
    return Promise.resolve(this.replace(queued.id, { status: 'running', startedAt: this.now() }));
  }

  reportProgress(runId: number, progress: RunProgress): Promise<void> {
    return settle(() => {
      this.requireRunning(runId);
      this.replace(runId, { progress });
    });
  }

  finish(runId: number, outcome: RunOutcome): Promise<void> {
    return settle(() => {
      this.requireRunning(runId);
      this.replace(runId, {
        status: outcome.status,
        error: outcome.status === 'failed' ? outcome.error : null,
        finishedAt: this.now(),
      });
      if (outcome.status !== 'completed' && outcome.companyErrors.length > 0) {
        this.companyErrors.set(runId, [...outcome.companyErrors]);
      }
    });
  }

  interruptRunning(reason: string): Promise<readonly number[]> {
    const running = this.runs.filter((run) => run.status === 'running');
    for (const run of running) {
      this.replace(run.id, { status: 'interrupted', error: reason, finishedAt: this.now() });
    }
    return Promise.resolve(running.map((run) => run.id));
  }

  listRecent(limit: number): Promise<readonly Run[]> {
    return Promise.resolve([...this.runs].reverse().slice(0, limit));
  }

  findActive(): Promise<Run | null> {
    return Promise.resolve(this.runs.find((run) => ACTIVE.includes(run.status)) ?? null);
  }

  getDetail(runId: number): Promise<RunDetail> {
    const run = this.runs.find((candidate) => candidate.id === runId);
    if (run === undefined) return Promise.reject(new RunNotFound(runId));
    const companyErrors = (this.companyErrors.get(runId) ?? []).map((error) => ({
      ...error,
      companyName: this.companyNames.get(error.companyId) ?? `Company ${error.companyId}`,
    }));
    return Promise.resolve({ run, companyErrors });
  }

  /** Every Run, oldest first — for assertions. */
  all(): readonly Run[] {
    return [...this.runs];
  }

  private requireRunning(runId: number): void {
    if (!this.runs.some((run) => run.id === runId && run.status === 'running')) throw new RunNotFound(runId);
  }

  private replace(runId: number, changes: Partial<Run>): Run {
    const index = this.runs.findIndex((run) => run.id === runId);
    const current = this.runs[index];
    if (current === undefined) throw new RunNotFound(runId);
    const updated: Run = { ...current, ...changes };
    this.runs[index] = updated;
    return updated;
  }
}
