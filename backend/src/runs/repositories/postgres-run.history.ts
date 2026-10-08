import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';

import { RunCompanyErrorEntity } from '../../database/entities/run-company-error.entity';
import { RunEntity } from '../../database/entities/run.entity';
import { ACTIVE_RUN_STATUSES, type Run } from '../../domain/run';
import type { RunDetail, RunHistory } from '../run-history';
import { RunNotFound } from '../run-queue';
import { toRun } from './run-entity.mapper';

/** Largest value of a Postgres `integer` id column. */
const MAX_INTEGER_ID = 2_147_483_647;

/** Run history read from the `runs` and `run_company_errors` tables. */
@Injectable()
export class PostgresRunHistory implements RunHistory {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listRecent(limit: number): Promise<readonly Run[]> {
    const entities = await this.dataSource.getRepository(RunEntity).find({
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
    return entities.map(toRun);
  }

  async findActive(): Promise<Run | null> {
    const entity = await this.dataSource
      .getRepository(RunEntity)
      .findOne({ where: { status: In([...ACTIVE_RUN_STATUSES]) } });
    return entity === null ? null : toRun(entity);
  }

  async getDetail(runId: number): Promise<RunDetail> {
    // An id outside the column's range cannot exist; asking Postgres would be a driver error.
    if (!Number.isInteger(runId) || runId < 1 || runId > MAX_INTEGER_ID) throw new RunNotFound(runId);
    const entity = await this.dataSource.getRepository(RunEntity).findOne({ where: { id: runId } });
    if (entity === null) throw new RunNotFound(runId);
    const errors = await this.dataSource.getRepository(RunCompanyErrorEntity).find({
      where: { runId },
      relations: { company: true },
      order: { id: 'ASC' },
    });
    return {
      run: toRun(entity),
      companyErrors: errors.map((error) => ({
        companyId: error.companyId,
        // The foreign key is RESTRICT, so the company is always there.
        companyName: error.company?.displayName ?? `Company ${error.companyId}`,
        stage: error.stage,
        message: error.message,
      })),
    };
  }
}
