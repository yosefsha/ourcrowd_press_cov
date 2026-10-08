import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { EnqueueRunDto } from './dto/enqueue-run.dto';
import { InMemoryRunStore } from './repositories/in-memory-run.store';
import { RunsService } from './runs.service';

function service(store: InMemoryRunStore = new InMemoryRunStore()): RunsService {
  return new RunsService(store, store);
}

function dto(fields: Partial<EnqueueRunDto> & Pick<EnqueueRunDto, 'type'>): EnqueueRunDto {
  return fields;
}

describe('RunsService', () => {
  it('queues a dashboard Backfill with its cutoff and companies', async () => {
    const run = await service().enqueue(dto({ type: 'backfill', until: '2026-06-30', companyIds: [3, 5] }));

    expect(run).toMatchObject({
      type: 'backfill',
      trigger: 'dashboard',
      status: 'queued',
      params: { until: '2026-06-30', companyIds: [3, 5], reprocess: false },
    });
  });

  it('queues a Daily Check over every active company by default', async () => {
    const run = await service().enqueue(dto({ type: 'daily_check' }));

    expect(run.params).toEqual({ until: null, companyIds: null, reprocess: false });
  });

  it('rejects a cutoff date on a Daily Check', async () => {
    await expect(service().enqueue(dto({ type: 'daily_check', until: '2026-06-30' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('answers a conflict carrying the active Run while one is active', async () => {
    const store = new InMemoryRunStore();
    const active = await store.enqueue({
      type: 'daily_check',
      trigger: 'schedule',
      params: { until: null, companyIds: null, reprocess: false },
    });

    const error: unknown = await service(store).enqueue(dto({ type: 'backfill' })).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      message: `Run ${active.id} is already queued`,
      activeRun: { id: active.id, status: 'queued', createdAt: active.createdAt.toISOString() },
    });
  });

  it('maps an unknown Run to NotFoundException', async () => {
    await expect(service().getDetail(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the Run with named company errors', async () => {
    const store = new InMemoryRunStore(new Map([[4, 'Harvey']]));
    const run = await store.enqueue({ type: 'backfill', trigger: 'dashboard', params: { until: null, companyIds: null, reprocess: false } });
    await store.claimNext();
    await store.finish(run.id, {
      status: 'completed_with_errors',
      companyErrors: [{ companyId: 4, stage: 'relevance', message: 'unreadable verdict' }],
    });

    const detail = await service(store).getDetail(run.id);

    expect(detail.run.status).toBe('completed_with_errors');
    expect(detail.companyErrors).toEqual([
      { companyId: 4, companyName: 'Harvey', stage: 'relevance', message: 'unreadable verdict' },
    ]);
  });

  it('lists recent Runs newest first and finds the active one', async () => {
    const store = new InMemoryRunStore();
    const first = await store.enqueue({ type: 'backfill', trigger: 'dashboard', params: { until: null, companyIds: null, reprocess: false } });
    await store.claimNext();
    await store.finish(first.id, { status: 'completed' });
    const second = await store.enqueue({ type: 'daily_check', trigger: 'schedule', params: { until: null, companyIds: null, reprocess: false } });

    const subject = service(store);

    await expect(subject.listRecent(10)).resolves.toMatchObject([{ id: second.id }, { id: first.id }]);
    await expect(subject.listRecent(1)).resolves.toHaveLength(1);
    await expect(subject.findActive()).resolves.toMatchObject({ id: second.id });
  });
});
