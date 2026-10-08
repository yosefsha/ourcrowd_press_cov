import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError } from 'typeorm';

import { RunCompanyErrorEntity } from '../../database/entities/run-company-error.entity';
import { RunEntity } from '../../database/entities/run.entity';
import { ACTIVE_RUN_STATUSES, type Run, type RunOutcome, type RunProgress, type RunRequest } from '../../domain/run';
import { RunAlreadyActive, RunNotFound, type RunQueue } from '../run-queue';
import { toRun } from './run-entity.mapper';

const ONE_ACTIVE_RUN_INDEX = 'UQ_runs_one_active';
const UNIQUE_VIOLATION = '23505';
/** An enqueue that loses the race to a Run that then finishes at once retries this often. */
const MAX_ENQUEUE_ATTEMPTS = 3;

function isOneActiveRunViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === UNIQUE_VIOLATION &&
    'constraint' in driverError &&
    driverError.constraint === ONE_ACTIVE_RUN_INDEX
  );
}

/**
 * The Run queue on the `runs` table (ADR-009). The partial unique index
 * `UQ_runs_one_active` keeps at most one Run queued or running, so concurrent
 * enqueues are serialised by Postgres rather than by a read-then-write check.
 */
@Injectable()
export class PostgresRunQueue implements RunQueue {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async enqueue(request: RunRequest): Promise<Run> {
    const runs = this.dataSource.getRepository(RunEntity);
    for (let attempt = 1; ; attempt += 1) {
      try {
        const inserted = await runs.save(
          runs.create({
            type: request.type,
            trigger: request.trigger,
            params: request.params,
            status: 'queued',
            progress: null,
            error: null,
            startedAt: null,
            finishedAt: null,
          }),
        );
        return toRun(inserted);
      } catch (error) {
        if (!isOneActiveRunViolation(error)) throw error;
        const active = await runs.findOne({ where: { status: In([...ACTIVE_RUN_STATUSES]) } });
        if (active !== null) throw new RunAlreadyActive(toRun(active));
        // The active Run finished between the insert and the lookup: try again.
        if (attempt >= MAX_ENQUEUE_ATTEMPTS) throw error;
      }
    }
  }

  async claimNext(): Promise<Run | null> {
    // SKIP LOCKED: a second collector racing for the same row gets nothing
    // rather than waiting for it and claiming it a second time.
    const [rows] = await this.dataSource.query<[readonly { id: number }[], number]>(
      `UPDATE runs SET status = 'running', started_at = now()
        WHERE id = (
          SELECT id FROM runs WHERE status = 'queued'
           ORDER BY created_at, id
           LIMIT 1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING id`,
    );
    const claimed = rows[0];
    if (claimed === undefined) return null;
    return this.load(claimed.id);
  }

  async reportProgress(runId: number, progress: RunProgress): Promise<void> {
    const result = await this.dataSource
      .getRepository(RunEntity)
      .update({ id: runId, status: 'running' }, { progress });
    if (result.affected === 0) throw new RunNotFound(runId);
  }

  async finish(runId: number, outcome: RunOutcome): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(RunEntity).update(
        { id: runId, status: 'running' },
        {
          status: outcome.status,
          error: outcome.status === 'failed' ? outcome.error : null,
          finishedAt: () => 'now()',
        },
      );
      if (result.affected === 0) throw new RunNotFound(runId);
      const companyErrors = outcome.status === 'completed' ? [] : outcome.companyErrors;
      if (companyErrors.length > 0) {
        await manager.getRepository(RunCompanyErrorEntity).insert(
          companyErrors.map((companyError) => ({
            runId,
            companyId: companyError.companyId,
            stage: companyError.stage,
            message: companyError.message,
          })),
        );
      }
    });
  }

  async interruptRunning(reason: string): Promise<readonly number[]> {
    const [rows] = await this.dataSource.query<[readonly { id: number }[], number]>(
      `UPDATE runs SET status = 'interrupted', error = $1, finished_at = now()
        WHERE status = 'running'
        RETURNING id`,
      [reason],
    );
    return rows.map((row) => row.id);
  }

  private async load(runId: number): Promise<Run> {
    const entity = await this.dataSource.getRepository(RunEntity).findOne({ where: { id: runId } });
    if (entity === null) throw new RunNotFound(runId);
    return toRun(entity);
  }
}
