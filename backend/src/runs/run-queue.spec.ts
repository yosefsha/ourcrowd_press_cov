import type { Run } from '../domain/run';
import { NoExecutorForRunType } from './run-executor';
import { RunAlreadyActive, RunNotFound } from './run-queue';

const activeRun: Run = {
  id: 7,
  type: 'backfill',
  status: 'running',
  trigger: 'dashboard',
  params: { until: null, companyIds: null, reprocess: false },
  progress: null,
  error: null,
  createdAt: new Date('2026-10-07T07:00:00Z'),
  startedAt: new Date('2026-10-07T07:00:03Z'),
  finishedAt: null,
};

describe('Run errors', () => {
  it('RunAlreadyActive carries the active Run', () => {
    const error = new RunAlreadyActive(activeRun);

    expect(error.name).toBe('RunAlreadyActive');
    expect(error.activeRun).toBe(activeRun);
    expect(error.message).toBe('Run 7 is already running');
  });

  it('RunNotFound names the Run', () => {
    expect(new RunNotFound(3)).toMatchObject({ name: 'RunNotFound', runId: 3 });
  });

  it('NoExecutorForRunType names the type', () => {
    expect(new NoExecutorForRunType('daily_check').message).toContain('daily_check');
  });
});
