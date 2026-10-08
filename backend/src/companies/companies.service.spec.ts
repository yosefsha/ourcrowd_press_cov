import { ConflictException, NotFoundException } from '@nestjs/common';

import type { RunRequest } from '../domain/run';
import { InMemoryRunStore } from '../runs/repositories/in-memory-run.store';
import { CompaniesService, SENT_TO_REVIEW_REASON } from './companies.service';
import { InMemoryTrackedCompanyRepository } from './repositories/in-memory-tracked-company.repository';

describe('CompaniesService', () => {
  let companies: InMemoryTrackedCompanyRepository;
  let runQueue: InMemoryRunStore;
  let enqueued: RunRequest[];
  let service: CompaniesService;

  async function seed(displayName: string, status: 'active' | 'needs_review' = 'active'): Promise<number> {
    const company = await companies.create({
      sourceName: displayName,
      status,
      reviewReason: status === 'needs_review' ? 'flagged' : null,
      profile: { displayName, aliases: [], domain: null, description: null, searchTerms: [] },
    });
    return company.id;
  }

  beforeEach(() => {
    companies = new InMemoryTrackedCompanyRepository();
    runQueue = new InMemoryRunStore();
    enqueued = [];
    const enqueue = runQueue.enqueue.bind(runQueue);
    jest.spyOn(runQueue, 'enqueue').mockImplementation((request: RunRequest) => {
      enqueued.push(request);
      return enqueue(request);
    });
    service = new CompaniesService(companies, runQueue);
  });

  describe('list', () => {
    it('filters by status and query', async () => {
      await seed('Harvey', 'needs_review');
      await seed('Quantum Machines');

      expect((await service.list({ status: 'needs_review' })).map((c) => c.profile.displayName)).toEqual(['Harvey']);
      expect((await service.list({ q: 'quantum' })).map((c) => c.profile.displayName)).toEqual(['Quantum Machines']);
      expect(await service.list({})).toHaveLength(2);
    });
  });

  describe('create', () => {
    it('adds an active company with no Source Name and empty optional fields', async () => {
      const created = await service.create({ displayName: 'Hand Added' });

      expect(created).toMatchObject({
        sourceName: null,
        status: 'active',
        reviewReason: null,
        profile: { displayName: 'Hand Added', aliases: [], domain: null, description: null, searchTerms: [] },
      });
    });

    it('answers 409 naming displayName when a live company already has the name', async () => {
      await seed('Harvey');

      const attempt = service.create({ displayName: 'harvey' });

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toMatchObject({
        response: { message: ['displayName "harvey" is already used by another company that is not deactivated'] },
      });
    });
  });

  describe('update', () => {
    it('replaces only the given fields', async () => {
      const id = await seed('Lambda');

      const updated = await service.update(id, { domain: 'lambda.ai', searchTerms: ['"Lambda" GPU cloud'] });

      expect(updated.profile).toEqual({
        displayName: 'Lambda',
        aliases: [],
        domain: 'lambda.ai',
        description: null,
        searchTerms: ['"Lambda" GPU cloud'],
      });
      expect(updated.sourceName).toBe('Lambda');
    });

    it('returns the company unchanged for an empty change', async () => {
      const id = await seed('Lambda');

      await expect(service.update(id, {})).resolves.toMatchObject({ id, profile: { displayName: 'Lambda' } });
    });

    it('answers 409 for a deactivated company, whose profile is frozen', async () => {
      const id = await seed('Ludeo');
      await service.deactivate(id);

      await expect(service.update(id, { description: 'x' })).rejects.toThrow('Cannot edit: Ludeo is deactivated');
      await expect(service.update(id, {})).rejects.toThrow(ConflictException);
    });

    it('answers 404 for an unknown company', async () => {
      await expect(service.update(99, { description: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.update(99, {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers 409 when renaming onto another live company', async () => {
      await seed('Harvey');
      const id = await seed('Wave');

      await expect(service.update(id, { displayName: 'Harvey' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('lifecycle', () => {
    it('marks a Needs Review company reviewed, clearing its reason', async () => {
      const id = await seed('Harvey', 'needs_review');

      await expect(service.markReviewed(id)).resolves.toMatchObject({ status: 'active', reviewReason: null });
    });

    it('sends an active company back to Needs Review with a reason', async () => {
      const id = await seed('Lambda');

      await expect(service.sendToReview(id)).resolves.toMatchObject({
        status: 'needs_review',
        reviewReason: SENT_TO_REVIEW_REASON,
      });
    });

    it('deactivates from active or Needs Review', async () => {
      const active = await seed('Lambda');
      const review = await seed('Harvey', 'needs_review');

      await expect(service.deactivate(active)).resolves.toMatchObject({ status: 'deactivated' });
      await expect(service.deactivate(review)).resolves.toMatchObject({ status: 'deactivated' });
    });

    it.each([
      ['markReviewed', 'active', 'Cannot mark as reviewed: Lambda is already active'],
      ['sendToReview', 'needs_review', 'Cannot send to Needs Review: Lambda is in Needs Review'],
    ] as const)('%s from %s answers 409', async (action, status, message) => {
      const id = await seed('Lambda', status);

      await expect(service[action](id)).rejects.toMatchObject({ response: { message, statusCode: 409 } });
    });

    it('refuses every status change on a deactivated company', async () => {
      const id = await seed('Lambda');
      await service.deactivate(id);

      for (const action of ['markReviewed', 'sendToReview', 'deactivate'] as const) {
        await expect(service[action](id)).rejects.toThrow(ConflictException);
        await expect(service[action](id)).rejects.toThrow('Lambda is deactivated');
      }
    });

    it('answers 404 for an unknown company', async () => {
      await expect(service.markReviewed(5)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('frees the display name once a company is deactivated', async () => {
      const id = await seed('Ludeo');
      await service.deactivate(id);

      await expect(service.create({ displayName: 'Ludeo' })).resolves.toMatchObject({ status: 'active' });
    });
  });

  describe('reprocess', () => {
    it('queues a single-company Backfill with reprocess: true', async () => {
      const id = await seed('Lambda');

      const run = await service.reprocess(id);

      expect(enqueued).toEqual([
        { type: 'backfill', trigger: 'dashboard', params: { until: null, companyIds: [id], reprocess: true } },
      ]);
      expect(run).toMatchObject({ status: 'queued', type: 'backfill' });
    });

    it('answers 409 with the active Run while another Run is active', async () => {
      const id = await seed('Lambda');
      const running = await runQueue.enqueue({
        type: 'daily_check',
        trigger: 'schedule',
        params: { until: null, companyIds: null, reprocess: false },
      });
      await runQueue.claimNext();
      enqueued.length = 0;

      await expect(service.reprocess(id)).rejects.toMatchObject({
        response: {
          message: 'Another Run is already running; re-process once it has finished',
          activeRun: { ...running, status: 'running', startedAt: expect.any(Date) as unknown },
        },
      });
    });

    it.each(['needs_review', 'deactivated'] as const)('refuses a %s company without queueing', async (status) => {
      const id = await seed('Harvey', status === 'needs_review' ? 'needs_review' : 'active');
      if (status === 'deactivated') await service.deactivate(id);

      await expect(service.reprocess(id)).rejects.toThrow(ConflictException);
      await expect(service.reprocess(id)).rejects.toThrow('Only an active company can be re-processed');
      expect(enqueued).toEqual([]);
    });

    it('answers 404 for an unknown company', async () => {
      await expect(service.reprocess(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets an unexpected queue failure through', async () => {
      const id = await seed('Lambda');
      jest.spyOn(runQueue, 'enqueue').mockRejectedValue(new Error('boom'));

      await expect(service.reprocess(id)).rejects.toThrow('boom');
    });
  });
});
