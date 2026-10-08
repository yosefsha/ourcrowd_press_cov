import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { EnqueueRunDto, MAX_RUN_COMPANY_IDS } from './enqueue-run.dto';

function problems(body: Record<string, unknown>): string[] {
  const errors = validateSync(plainToInstance(EnqueueRunDto, body), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((error) => error.property);
}

describe('EnqueueRunDto', () => {
  it.each([
    [{ type: 'backfill' }],
    [{ type: 'daily_check' }],
    [{ type: 'backfill', until: '2026-02-28', companyIds: [1, 2] }],
  ])('accepts %j', (body) => {
    expect(problems(body)).toEqual([]);
  });

  it.each([
    [{}, 'type'],
    [{ type: 'reprocess' }, 'type'],
    [{ type: 'backfill', until: '2026-02-30' }, 'until'],
    [{ type: 'backfill', until: '2026-02-28T00:00:00Z' }, 'until'],
    [{ type: 'backfill', companyIds: [] }, 'companyIds'],
    [{ type: 'backfill', companyIds: [1, 1] }, 'companyIds'],
    [{ type: 'backfill', companyIds: [0] }, 'companyIds'],
    [{ type: 'backfill', companyIds: ['1'] }, 'companyIds'],
    [{ type: 'backfill', companyIds: Array.from({ length: MAX_RUN_COMPANY_IDS + 1 }, (_v, i) => i + 1) }, 'companyIds'],
    [{ type: 'backfill', reprocess: true }, 'reprocess'],
  ])('rejects %j on %s', (body, property) => {
    expect(problems(body)).toContain(property);
  });
});
