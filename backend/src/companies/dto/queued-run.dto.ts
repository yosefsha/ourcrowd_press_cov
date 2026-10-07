import type { Run, RunParams, RunProgress, RunStatus, RunTrigger, RunType } from '../../domain/run';

/** The Run a Re-process queued, as the runs API spells a Run. */
export class QueuedRunDto {
  readonly id: number;
  readonly type: RunType;
  readonly status: RunStatus;
  readonly trigger: RunTrigger;
  readonly params: RunParams;
  readonly progress: RunProgress | null;
  readonly error: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;

  constructor(run: Run) {
    this.id = run.id;
    this.type = run.type;
    this.status = run.status;
    this.trigger = run.trigger;
    this.params = run.params;
    this.progress = run.progress;
    this.error = run.error;
    this.createdAt = run.createdAt.toISOString();
    this.startedAt = run.startedAt?.toISOString() ?? null;
    this.finishedAt = run.finishedAt?.toISOString() ?? null;
  }
}
