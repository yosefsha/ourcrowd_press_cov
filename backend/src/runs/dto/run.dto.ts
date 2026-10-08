import type { Run, RunParams, RunProgress, RunStatus, RunTrigger, RunType } from '../../domain/run';

/** A Run as the API returns it; timestamps are ISO-8601 strings. */
export class RunDto {
  readonly id!: number;
  readonly type!: RunType;
  readonly status!: RunStatus;
  readonly trigger!: RunTrigger;
  readonly params!: RunParams;
  readonly progress!: RunProgress | null;
  readonly error!: string | null;
  readonly createdAt!: string;
  readonly startedAt!: string | null;
  readonly finishedAt!: string | null;

  static from(run: Run): RunDto {
    return Object.assign(new RunDto(), {
      id: run.id,
      type: run.type,
      status: run.status,
      trigger: run.trigger,
      params: run.params,
      progress: run.progress,
      error: run.error,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    });
  }
}
