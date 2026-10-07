import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import type { RunType } from '../../domain/run';
import { type RunHistory, RunHistoryUnavailable } from '../run-history';

/** Past Runs, read from the `runs` table. */
@Injectable()
export class PostgresRunHistory implements RunHistory {
  constructor(private readonly manager: EntityManager) {}

  async lastSuccessfulStart(type: RunType, excludingRunId: number): Promise<Date | null> {
    let rows: { started_at: Date }[];
    try {
      rows = await this.manager.query<{ started_at: Date }[]>(
        `SELECT started_at FROM runs
          WHERE type = $1 AND status = 'completed' AND id <> $2 AND started_at IS NOT NULL
            AND jsonb_typeof(params -> 'companyIds') = 'null'
          ORDER BY started_at DESC
          LIMIT 1`,
        [type, excludingRunId],
      );
    } catch (error) {
      throw new RunHistoryUnavailable('Could not read the Run history', { cause: error });
    }
    const [row] = rows;
    return row === undefined ? null : new Date(row.started_at);
  }
}
