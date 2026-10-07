import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { Run, RunRequest } from '../domain/run';
import type { EnqueueRunDto } from './dto/enqueue-run.dto';
import { RunDto } from './dto/run.dto';
import { RUN_HISTORY, type RunDetail, type RunHistory } from './run-history';
import { RUN_QUEUE, RunAlreadyActive, RunNotFound, type RunQueue } from './run-queue';

/** Runs as the dashboard asks for and sees them. */
@Injectable()
export class RunsService {
  constructor(
    @Inject(RUN_QUEUE) private readonly queue: RunQueue,
    @Inject(RUN_HISTORY) private readonly history: RunHistory,
  ) {}

  /**
   * Queues a Run asked for from the dashboard. Throws `ConflictException`
   * carrying the active Run while another Run is queued or running.
   */
  async enqueue(dto: EnqueueRunDto): Promise<Run> {
    try {
      return await this.queue.enqueue(toRunRequest(dto));
    } catch (error) {
      if (error instanceof RunAlreadyActive) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: error.message,
          activeRun: RunDto.from(error.activeRun),
        });
      }
      throw error;
    }
  }

  listRecent(limit: number): Promise<readonly Run[]> {
    return this.history.listRecent(limit);
  }

  findActive(): Promise<Run | null> {
    return this.history.findActive();
  }

  /** Throws `NotFoundException` for an unknown Run. */
  async getDetail(runId: number): Promise<RunDetail> {
    try {
      return await this.history.getDetail(runId);
    } catch (error) {
      if (error instanceof RunNotFound) throw new NotFoundException(error.message);
      throw error;
    }
  }
}

/** A cutoff date only means something to a Backfill; a Daily Check always looks back from today. */
function toRunRequest(dto: EnqueueRunDto): RunRequest {
  if (dto.type !== 'backfill' && dto.until !== undefined) {
    throw new BadRequestException('until applies to a Backfill only');
  }
  return {
    type: dto.type,
    trigger: 'dashboard',
    params: {
      until: dto.until ?? null,
      companyIds: dto.companyIds ?? null,
      reprocess: false,
    },
  };
}
