import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  isRunInProgress,
  latestCompletedRunAt,
  resolveBackfillCutoff,
  shouldPollRuns,
  toIsoDate,
} from './runs.ts';
import {
  completedBackfill,
  dailyCheckWithErrors,
  failedDailyCheck,
  healthyCollector,
  runningBackfill,
} from './test/alertsOperationsFixtures.tsx';
import { buildRun } from './test/fixtures.ts';

describe('isRunInProgress', () => {
  it.each([
    ['queued', true],
    ['running', true],
    ['completed', false],
    ['completed_with_errors', false],
    ['failed', false],
    ['interrupted', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(isRunInProgress({ status })).toBe(expected);
  });
});

describe('shouldPollRuns', () => {
  it('polls while a Run is active', () => {
    expect(shouldPollRuns(runningBackfill, [], healthyCollector)).toBe(true);
  });

  it('keeps polling while the history still shows a Run in progress', () => {
    expect(shouldPollRuns(null, [runningBackfill], healthyCollector)).toBe(true);
  });

  it('polls when the collector reports it is running a Run not seen yet', () => {
    expect(shouldPollRuns(null, [completedBackfill], { ...healthyCollector, state: 'running' })).toBe(true);
  });

  it('ignores a running state from an offline collector', () => {
    expect(shouldPollRuns(null, [], { ...healthyCollector, online: false, state: 'running' })).toBe(false);
  });

  it('stops when nothing is queued or running', () => {
    expect(shouldPollRuns(null, [completedBackfill, failedDailyCheck], healthyCollector)).toBe(false);
  });

  it('does not poll before anything is known', () => {
    expect(shouldPollRuns(undefined, undefined, undefined)).toBe(false);
  });
});

describe('latestCompletedRunAt', () => {
  it('picks the newest finish of a completed or completed-with-errors Run', () => {
    expect(latestCompletedRunAt([completedBackfill, dailyCheckWithErrors])).toBe(dailyCheckWithErrors.finishedAt);
  });

  it('skips failed, interrupted and unfinished Runs', () => {
    const interrupted = buildRun({ id: 9, status: 'interrupted', finishedAt: '2026-10-10T00:00:00.000Z' });
    expect(latestCompletedRunAt([failedDailyCheck, interrupted, runningBackfill, completedBackfill])).toBe(
      completedBackfill.finishedAt,
    );
  });

  it('is null with no completed Run', () => {
    expect(latestCompletedRunAt([])).toBeNull();
    expect(latestCompletedRunAt([failedDailyCheck])).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration('2026-10-07T06:00:00.000Z', '2026-10-07T06:00:14.000Z')).toBe('14s');
    expect(formatDuration('2026-10-07T06:00:00.000Z', '2026-10-07T06:02:05.000Z')).toBe('2m 05s');
    expect(formatDuration('2026-10-07T06:00:00.000Z', '2026-10-07T07:02:03.000Z')).toBe('1h 02m 03s');
  });

  it('is null when a bound is missing, unparseable or reversed', () => {
    expect(formatDuration(null, '2026-10-07T06:00:14.000Z')).toBeNull();
    expect(formatDuration('2026-10-07T06:00:00.000Z', null)).toBeNull();
    expect(formatDuration('not a date', '2026-10-07T06:00:14.000Z')).toBeNull();
    expect(formatDuration('2026-10-07T06:00:14.000Z', '2026-10-07T06:00:00.000Z')).toBeNull();
  });
});

describe('resolveBackfillCutoff', () => {
  const today = new Date(2026, 9, 7, 15, 30); // 7 Oct 2026, local time

  it('sends no cutoff for "today"', () => {
    expect(resolveBackfillCutoff({ kind: 'today' }, today)).toEqual({ ok: true, until: undefined });
  });

  it('passes a past or current date through', () => {
    expect(resolveBackfillCutoff({ kind: 'date', date: '2026-10-01' }, today)).toEqual({ ok: true, until: '2026-10-01' });
    expect(resolveBackfillCutoff({ kind: 'date', date: '2026-10-07' }, today)).toEqual({ ok: true, until: '2026-10-07' });
  });

  it('rejects a future, empty or impossible date', () => {
    expect(resolveBackfillCutoff({ kind: 'date', date: '2026-10-08' }, today).ok).toBe(false);
    expect(resolveBackfillCutoff({ kind: 'date', date: '' }, today).ok).toBe(false);
    expect(resolveBackfillCutoff({ kind: 'date', date: '2026-02-30' }, today).ok).toBe(false);
  });

  it('turns "N days ago" into a calendar date, across a month boundary', () => {
    expect(resolveBackfillCutoff({ kind: 'daysAgo', days: '3' }, today)).toEqual({ ok: true, until: '2026-10-04' });
    expect(resolveBackfillCutoff({ kind: 'daysAgo', days: ' 10 ' }, today)).toEqual({ ok: true, until: '2026-09-27' });
  });

  it.each(['0', '-2', '1.5', 'abc', ''])('rejects %j days', (days) => {
    expect(resolveBackfillCutoff({ kind: 'daysAgo', days }, today).ok).toBe(false);
  });

  it('formats local calendar dates', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
