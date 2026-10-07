/**
 * Pure helpers for Runs and collector health: labels, polling decisions,
 * the Backfill cutoff and the "as of" timestamp. No React, no I/O.
 */
import type { CollectorHealth, CollectorState, IsoDate, IsoDateTime, Run, RunStatus, RunTrigger, RunType } from './types.ts';

/** How many recent Runs the Operations page and the "as of" slot read (one shared cache entry). */
export const RUN_HISTORY_LIMIT = 20;

export const RUN_TYPE_LABELS: Readonly<Record<RunType, string>> = {
  backfill: 'Backfill',
  daily_check: 'Daily Check',
};

export const RUN_STATUS_LABELS: Readonly<Record<RunStatus, string>> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  completed_with_errors: 'Completed with errors',
  failed: 'Failed',
  interrupted: 'Interrupted',
};

export const RUN_TRIGGER_LABELS: Readonly<Record<RunTrigger, string>> = {
  dashboard: 'Dashboard',
  schedule: 'Schedule',
};

export const COLLECTOR_STATE_LABELS: Readonly<Record<CollectorState, string>> = {
  idle: 'Idle',
  importing: 'Importing',
  running: 'Running',
};

/** A Run that is queued or running blocks every new enqueue (ADR-009). */
export function isRunInProgress(run: Pick<Run, 'status'>): boolean {
  return run.status === 'queued' || run.status === 'running';
}

/** A Run whose data the dashboard now reflects. Failed and interrupted Runs refreshed nothing reliably. */
export function isRunFinishedSuccessfully(run: Pick<Run, 'status'>): boolean {
  return run.status === 'completed' || run.status === 'completed_with_errors';
}

/**
 * Whether Run state is changing and must be polled at the live interval:
 * a Run is known to be queued/running, the history still shows one (it has
 * finished since but the history has not caught up), or the collector reports
 * it is executing a Run the dashboard has not seen yet (e.g. the daily cron).
 */
export function shouldPollRuns(
  activeRun: Run | null | undefined,
  history: readonly Run[] | undefined,
  health: CollectorHealth | undefined,
): boolean {
  if (activeRun !== null && activeRun !== undefined) return true;
  if (history?.some(isRunInProgress) === true) return true;
  return health?.online === true && health.state === 'running';
}

/** When the dashboard data was last refreshed: the newest finish time of a completed Run, or null. */
export function latestCompletedRunAt(runs: readonly Run[]): IsoDateTime | null {
  let latest: { readonly at: IsoDateTime; readonly ms: number } | null = null;
  for (const run of runs) {
    if (!isRunFinishedSuccessfully(run) || run.finishedAt === null) continue;
    const ms = Date.parse(run.finishedAt);
    if (Number.isNaN(ms)) continue;
    if (latest === null || ms > latest.ms) latest = { at: run.finishedAt, ms };
  }
  return latest?.at ?? null;
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** A timestamp in the reader's locale and time zone; the raw value if it does not parse. */
export function formatDateTime(value: IsoDateTime): string {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : dateTimeFormat.format(ms);
}

/** Elapsed time between two timestamps as `1h 02m 03s` / `2m 05s` / `14s`; null if either is missing. */
export function formatDuration(start: IsoDateTime | null, end: IsoDateTime | null): string | null {
  if (start === null || end === null) return null;
  const elapsedMs = Date.parse(end) - Date.parse(start);
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return null;
  const totalSeconds = Math.round(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

// ---------------------------------------------------------------------------
// Backfill cutoff
// ---------------------------------------------------------------------------

/** How the Backfill cutoff (`until`) was chosen on the form. Inputs stay raw strings until resolved. */
export type BackfillCutoff =
  | { readonly kind: 'today' }
  | { readonly kind: 'date'; readonly date: string }
  | { readonly kind: 'daysAgo'; readonly days: string };

export type CutoffResolution =
  | { readonly ok: true; readonly until: IsoDate | undefined }
  | { readonly ok: false; readonly error: string };

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A local calendar date as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): IsoDate {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isRealCalendarDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) return false;
  const [, year, month, day] = match.map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Turns the form's cutoff choice into the `until` the API takes. "Today" sends
 * no cutoff at all (the API's default), so the request matches the contract.
 */
export function resolveBackfillCutoff(cutoff: BackfillCutoff, today: Date): CutoffResolution {
  const todayIso = toIsoDate(today);
  switch (cutoff.kind) {
    case 'today':
      return { ok: true, until: undefined };
    case 'date': {
      if (!isRealCalendarDate(cutoff.date)) return { ok: false, error: 'Enter the cutoff as a calendar date.' };
      // ISO dates compare correctly as strings.
      if (cutoff.date > todayIso) return { ok: false, error: 'The cutoff cannot be in the future.' };
      return { ok: true, until: cutoff.date };
    }
    case 'daysAgo': {
      const trimmed = cutoff.days.trim();
      if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
        return { ok: false, error: 'Enter a whole number of days, 1 or more.' };
      }
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - Number(trimmed));
      return { ok: true, until: toIsoDate(date) };
    }
  }
}
