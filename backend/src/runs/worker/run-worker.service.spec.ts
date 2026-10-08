import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { DataExportFailed, type DataExporter } from '../../data-export/data-exporter';
import type { Run, RunOutcome, RunType } from '../../domain/run';
import { InMemoryRunStore } from '../repositories/in-memory-run.store';
import { RunInterrupted, type RunExecutor, type RunProgressReporter } from '../run-executor';
import { CollectorActivity } from './collector-activity';
import { INTERRUPTED_BY_RESTART, INTERRUPTED_BY_SHUTDOWN, RunWorker } from './run-worker.service';

class RecordingExporter implements DataExporter {
  calls = 0;
  constructor(private readonly failure: Error | null = null) {}
  exportAll(): Promise<void> {
    this.calls += 1;
    return this.failure === null ? Promise.resolve() : Promise.reject(this.failure);
  }
}

class ScriptedExecutor implements RunExecutor {
  readonly executed: Run[] = [];
  stateDuringRun: string | null = null;
  constructor(
    readonly runType: RunType,
    private readonly behave: (run: Run, progress: RunProgressReporter, signal: AbortSignal) => Promise<RunOutcome>,
    private readonly activity?: CollectorActivity,
  ) {}
  execute(run: Run, progress: RunProgressReporter, signal: AbortSignal): Promise<RunOutcome> {
    this.executed.push(run);
    this.stateDuringRun = this.activity?.state ?? null;
    return this.behave(run, progress, signal);
  }
}

const config = new ConfigService<AppConfig, true>({ runs: { pollIntervalMs: 1000 } });
const backfill = { type: 'backfill', trigger: 'dashboard', params: { until: null, companyIds: null, reprocess: false } } as const;
const dailyCheck = { ...backfill, type: 'daily_check', trigger: 'schedule' } as const;

function worker(
  store: InMemoryRunStore,
  executors: readonly RunExecutor[],
  exporter: DataExporter = new RecordingExporter(),
  activity = new CollectorActivity(),
): RunWorker {
  return new RunWorker(store, exporter, activity, config, executors);
}

describe('RunWorker', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  it('marks a Run left running by a previous process as interrupted on startup', async () => {
    const store = new InMemoryRunStore();
    const stale = await store.enqueue(backfill);
    await store.claimNext();

    await expect(worker(store, []).recoverInterruptedRuns()).resolves.toEqual([stale.id]);

    expect(store.all()[0]).toMatchObject({ status: 'interrupted', error: INTERRUPTED_BY_RESTART });
  });

  it('leaves a queued Run for the loop to claim on startup', async () => {
    const store = new InMemoryRunStore();
    await store.enqueue(backfill);

    await expect(worker(store, []).recoverInterruptedRuns()).resolves.toEqual([]);

    expect(store.all()[0]?.status).toBe('queued');
  });

  it('returns null and exports nothing when no Run is queued', async () => {
    const exporter = new RecordingExporter();

    await expect(worker(new InMemoryRunStore(), [], exporter).pollOnce()).resolves.toBeNull();

    expect(exporter.calls).toBe(0);
  });

  it('dispatches to the executor for the Run type and records its outcome', async () => {
    const store = new InMemoryRunStore();
    const activity = new CollectorActivity();
    const backfills = new ScriptedExecutor('backfill', () => Promise.resolve({ status: 'completed' }));
    const dailyChecks = new ScriptedExecutor(
      'daily_check',
      async (_run, progress) => {
        await progress.report({
          companiesTotal: 2,
          companiesDone: 2,
          candidatesFound: 5,
          candidatesClassified: 5,
          mentionsConfirmed: 1,
          companyErrors: 1,
          currentCompany: null,
        });
        return {
          status: 'completed_with_errors',
          companyErrors: [{ companyId: 4, stage: 'collection', message: 'Google News answered 503' }],
        };
      },
      activity,
    );
    const queued = await store.enqueue(dailyCheck);

    await worker(store, [backfills, dailyChecks], new RecordingExporter(), activity).pollOnce();

    expect(backfills.executed).toEqual([]);
    expect(dailyChecks.executed.map((run) => run.id)).toEqual([queued.id]);
    expect(dailyChecks.stateDuringRun).toBe('running');
    expect(activity.state).toBe('idle');
    const detail = await store.getDetail(queued.id);
    expect(detail.run).toMatchObject({ status: 'completed_with_errors', error: null });
    expect(detail.run.progress?.mentionsConfirmed).toBe(1);
    expect(detail.companyErrors).toEqual([
      { companyId: 4, companyName: 'Company 4', stage: 'collection', message: 'Google News answered 503' },
    ]);
  });

  it('marks the Run failed when its executor throws', async () => {
    const store = new InMemoryRunStore();
    const failing = new ScriptedExecutor('backfill', () => Promise.reject(new Error('Ollama is unreachable')));
    await store.enqueue(backfill);

    await worker(store, [failing]).pollOnce();

    expect(store.all()[0]).toMatchObject({ status: 'failed', error: 'Ollama is unreachable' });
  });

  it('fails a Run whose type has no registered executor', async () => {
    const store = new InMemoryRunStore();
    await store.enqueue(dailyCheck);

    await worker(store, []).pollOnce();

    expect(store.all()[0]).toMatchObject({
      status: 'failed',
      error: 'No executor is registered for Runs of type daily_check',
    });
  });

  it('refuses two executors for the same Run type', () => {
    const done = (): Promise<RunOutcome> => Promise.resolve({ status: 'completed' });
    expect(() => worker(new InMemoryRunStore(), [new ScriptedExecutor('backfill', done), new ScriptedExecutor('backfill', done)])).toThrow(
      'More than one RunExecutor is registered for Runs of type backfill',
    );
  });

  it.each([
    ['completes', (): Promise<RunOutcome> => Promise.resolve({ status: 'completed' })],
    ['fails', (): Promise<RunOutcome> => Promise.reject(new Error('boom'))],
  ])('calls the exporter after a Run that %s', async (_label, behave) => {
    const store = new InMemoryRunStore();
    const exporter = new RecordingExporter();
    await store.enqueue(backfill);

    await worker(store, [new ScriptedExecutor('backfill', behave)], exporter).pollOnce();

    expect(exporter.calls).toBe(1);
  });

  it('calls the exporter after each of several Runs', async () => {
    const store = new InMemoryRunStore();
    const exporter = new RecordingExporter();
    const subject = worker(store, [new ScriptedExecutor('backfill', () => Promise.resolve({ status: 'completed' }))], exporter);

    for (let i = 0; i < 3; i += 1) {
      await store.enqueue(backfill);
      await subject.pollOnce();
    }

    expect(exporter.calls).toBe(3);
  });

  it('keeps the Run outcome when the export fails', async () => {
    const store = new InMemoryRunStore();
    await store.enqueue(backfill);
    const executor = new ScriptedExecutor('backfill', () => Promise.resolve({ status: 'completed' }));

    await worker(store, [executor], new RecordingExporter(new DataExportFailed('disk full'))).pollOnce();

    expect(store.all()[0]?.status).toBe('completed');
  });


  it('on shutdown signals the executor and marks the Run interrupted', async () => {
    const store = new InMemoryRunStore();
    const exporter = new RecordingExporter();
    let started!: () => void;
    const executorStarted = new Promise<void>((resolve) => (started = resolve));
    const executor = new ScriptedExecutor(
      'backfill',
      (run, _progress, signal) =>
        new Promise<RunOutcome>((_resolve, reject) => {
          started();
          // Finishes the company in hand, then stops.
          signal.addEventListener('abort', () => reject(new RunInterrupted(run.id)));
        }),
    );
    await store.enqueue(backfill);
    const subject = worker(store, [executor], exporter);

    await subject.onApplicationBootstrap();
    await executorStarted;
    await subject.beforeApplicationShutdown();

    expect(store.all()[0]).toMatchObject({ status: 'interrupted', error: INTERRUPTED_BY_SHUTDOWN });
    expect(exporter.calls).toBe(1);
  });

  it('stops polling after shutdown', async () => {
    jest.useFakeTimers();
    try {
      const store = new InMemoryRunStore();
      const claim = jest.spyOn(store, 'claimNext');
      const subject = worker(store, []);

      await subject.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(0);
      await subject.beforeApplicationShutdown();
      const claimsAtShutdown = claim.mock.calls.length;
      await jest.advanceTimersByTimeAsync(10_000);

      expect(claimsAtShutdown).toBe(1);
      expect(claim).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('polls again every interval', async () => {
    jest.useFakeTimers();
    try {
      const store = new InMemoryRunStore();
      const claim = jest.spyOn(store, 'claimNext');
      const subject = worker(store, []);

      await subject.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(3_000);
      await subject.beforeApplicationShutdown();

      expect(claim).toHaveBeenCalledTimes(4);
    } finally {
      jest.useRealTimers();
    }
  });
});
