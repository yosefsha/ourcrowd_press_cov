import { Logger } from '@nestjs/common';

import type { AmbiguityAssessment, AmbiguityTriage } from '../../classification/ambiguity-triage';
import { ClassifierOutputInvalid, ClassifierUnavailable } from '../../classification/classifier-errors';
import { parseSeedLine, type SeedCompany } from '../../domain/seed-line';
import { InMemoryTrackedCompanyRepository } from '../repositories/in-memory-tracked-company.repository';
import type { SeedImportProgress, SeedImportProgressSnapshot } from './seed-import-progress';
import { SeedImportService } from './seed-import.service';
import { SeedListUnavailable, type SeedListSource } from './seed-list-source';

/** Real Seed List lines (docs/ourcrowd_companies.txt). */
const SEED_LINES = ['Harvey', 'Lambda (lambda.ai)', 'Quantum Machines', 'Ro', 'Ludeo (formerly Edge)', 'Wave', 'Cerebras'];

/**
 * Triage verdicts listed explicitly per name. Ollama is not available where
 * these tests were written; they should switch to #6's recorded verdicts.
 */
const TRIAGE_VERDICTS: Readonly<Record<string, AmbiguityAssessment>> = {
  Lambda: {
    ambiguous: true,
    reason: '"Lambda" is a Greek letter and a programming term used widely in technology news.',
  },
  'Quantum Machines': { ambiguous: false, reason: 'A distinctive company name.' },
  Ludeo: { ambiguous: false, reason: 'A distinctive company name.' },
  Cerebras: { ambiguous: false, reason: 'A distinctive company name.' },
};

class InMemorySeedListSource implements SeedListSource {
  constructor(private readonly seeds: readonly SeedCompany[] | Error) {}

  read(): Promise<readonly SeedCompany[]> {
    return this.seeds instanceof Error ? Promise.reject(this.seeds) : Promise.resolve(this.seeds);
  }
}

class InMemoryTriage implements AmbiguityTriage {
  readonly asked: string[] = [];
  /** Names whose assessment throws this error instead of answering. */
  readonly failures = new Map<string, Error>();

  assess(name: string): Promise<AmbiguityAssessment> {
    this.asked.push(name);
    const failure = this.failures.get(name);
    if (failure !== undefined) return Promise.reject(failure);
    const verdict = TRIAGE_VERDICTS[name];
    if (verdict === undefined) return Promise.reject(new Error(`No triage verdict listed for ${name}`));
    return Promise.resolve(verdict);
  }
}

class RecordingProgress implements SeedImportProgress {
  readonly events: (SeedImportProgressSnapshot | { readonly stopped: string | null })[] = [];

  importing(progress: SeedImportProgressSnapshot): Promise<void> {
    this.events.push(progress);
    return Promise.resolve();
  }

  stopped(detail: string | null): Promise<void> {
    this.events.push({ stopped: detail });
    return Promise.resolve();
  }
}

describe('SeedImportService', () => {
  const seeds = SEED_LINES.map((line, index) => parseSeedLine(line, index + 1));
  let companies: InMemoryTrackedCompanyRepository;
  let triage: InMemoryTriage;
  let progress: RecordingProgress;

  function service(source: SeedListSource = new InMemorySeedListSource(seeds)): SeedImportService {
    return new SeedImportService(companies, source, triage, progress);
  }

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  afterAll(() => {
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose', 'fatal']);
  });

  beforeEach(() => {
    companies = new InMemoryTrackedCompanyRepository();
    triage = new InMemoryTriage();
    progress = new RecordingProgress();
  });

  it('imports every line into an empty table, in Seed List order, with the parsed profile', async () => {
    const result = await service().importSeedList();

    expect(result).toEqual({ outcome: 'completed', imported: 7, needsReview: 4 });
    const all = await companies.list();
    expect(all.map((company) => company.sourceName).sort()).toEqual([...SEED_LINES].sort());
    const lambda = all.find((company) => company.sourceName === 'Lambda (lambda.ai)');
    expect(lambda?.profile).toEqual({
      displayName: 'Lambda',
      aliases: [],
      domain: 'lambda.ai',
      description: null,
      searchTerms: [],
    });
    const ludeo = all.find((company) => company.sourceName === 'Ludeo (formerly Edge)');
    expect(ludeo?.profile.aliases).toEqual(['Edge']);
  });

  it('sends a company flagged by the rules to Needs Review without asking the model', async () => {
    await service().importSeedList();

    const [harvey] = await companies.list({ query: 'Harvey' });
    expect(harvey).toMatchObject({ status: 'needs_review' });
    expect(harvey?.reviewReason).toContain('common first name');
    const [wave] = await companies.list({ query: 'Wave' });
    expect(wave?.reviewReason).toContain('common English word');
    const [ro] = await companies.list({ query: 'Ro', statuses: ['needs_review'], ids: [4] });
    expect(ro?.reviewReason).toContain('only 2 characters');
    expect(triage.asked).toEqual(['Lambda', 'Quantum Machines', 'Ludeo', 'Cerebras']);
  });

  it('sends a company the model flags to Needs Review with the model reason', async () => {
    await service().importSeedList();

    const [lambda] = await companies.list({ query: 'Lambda' });
    expect(lambda).toMatchObject({ status: 'needs_review', reviewReason: TRIAGE_VERDICTS.Lambda?.reason });
  });

  it('makes a company flagged by neither active, with no review reason (Quantum Machines)', async () => {
    await service().importSeedList();

    const [quantum] = await companies.list({ query: 'Quantum Machines' });
    expect(quantum).toMatchObject({ status: 'active', reviewReason: null });
  });

  it('treats an unreadable model answer as a flag', async () => {
    triage.failures.set('Cerebras', new ClassifierOutputInvalid('not JSON', 'maybe?'));

    const result = await service().importSeedList();

    expect(result).toMatchObject({ outcome: 'completed', needsReview: 5 });
    const [cerebras] = await companies.list({ query: 'Cerebras' });
    expect(cerebras?.status).toBe('needs_review');
    expect(cerebras?.reviewReason).toContain('could not be read');
  });

  it('reports progress after every company and goes idle at the end', async () => {
    await service().importSeedList();

    expect(progress.events).toEqual([
      { imported: 0, total: 7 },
      ...SEED_LINES.map((_line, index) => ({ imported: index + 1, total: 7 })),
      { stopped: null },
    ]);
  });

  describe('empty-table guard', () => {
    it('does nothing once a company has been added by hand', async () => {
      await companies.create({
        sourceName: null,
        status: 'active',
        reviewReason: null,
        profile: { displayName: 'Hand Added', aliases: [], domain: null, description: null, searchTerms: [] },
      });
      const source = new InMemorySeedListSource(new SeedListUnavailable('must not be read'));

      await expect(service(source).importSeedList()).resolves.toEqual({ outcome: 'skipped' });
      expect(await companies.list()).toHaveLength(1);
      expect(progress.events).toEqual([]);
    });

    it('does nothing when every Seed List line is already imported', async () => {
      await service().importSeedList();
      triage.asked.length = 0;
      progress.events.length = 0;

      await expect(service().importSeedList()).resolves.toEqual({ outcome: 'skipped' });
      expect(triage.asked).toEqual([]);
      expect(progress.events).toEqual([]);
    });

    it('does nothing when the table holds companies from a different Seed List', async () => {
      await companies.create({
        sourceName: 'Some Other Company',
        status: 'active',
        reviewReason: null,
        profile: { displayName: 'Some Other Company', aliases: [], domain: null, description: null, searchTerms: [] },
      });

      await expect(service().importSeedList()).resolves.toEqual({ outcome: 'skipped' });
      expect(await companies.list()).toHaveLength(1);
    });
  });

  describe('restart', () => {
    it('halts when the model is unreachable, keeping what was imported', async () => {
      triage.failures.set('Ludeo', new ClassifierUnavailable('connect ECONNREFUSED 127.0.0.1:11434'));

      const result = await service().importSeedList();

      expect(result).toMatchObject({ outcome: 'halted', imported: 4, needsReview: 3 });
      expect((await companies.list()).map((company) => company.sourceName)).toHaveLength(4);
      expect(progress.events.at(-1)).toEqual({ stopped: result.outcome === 'halted' ? result.reason : 'not halted' });
      expect(result.outcome === 'halted' && result.reason).toContain('paused at 4 of 7');
    });

    it('resumes with only the lines not yet imported, asking the model nothing twice', async () => {
      triage.failures.set('Ludeo', new ClassifierUnavailable('connect ECONNREFUSED 127.0.0.1:11434'));
      await service().importSeedList();
      triage.failures.clear();
      triage.asked.length = 0;
      progress.events.length = 0;

      const result = await service().importSeedList();

      expect(result).toEqual({ outcome: 'completed', imported: 3, needsReview: 1 });
      expect(triage.asked).toEqual(['Ludeo', 'Cerebras']);
      expect(progress.events[0]).toEqual({ imported: 4, total: 7 });
      const all = await companies.list();
      expect(all.map((company) => company.sourceName).sort()).toEqual([...SEED_LINES].sort());
    });

    it('stops and rethrows on any other failure, recording why', async () => {
      triage.failures.set('Lambda', new Error('unexpected'));

      await expect(service().importSeedList()).rejects.toThrow('unexpected');
      expect(progress.events.at(-1)).toEqual({ stopped: 'Seed List import failed at 1 of 7: unexpected' });
    });
  });

  it('skips a line whose display name clashes with a company already there', async () => {
    const clashing = [...seeds, parseSeedLine('Harvey Ltd.')];

    const result = await service(new InMemorySeedListSource(clashing)).importSeedList();

    expect(result).toMatchObject({ outcome: 'completed', imported: 7 });
    expect(await companies.list({ query: 'Harvey' })).toHaveLength(1);
  });

  it('fails loudly when the Seed List cannot be read', async () => {
    const source = new InMemorySeedListSource(new SeedListUnavailable('Cannot read the Seed List at /nowhere'));

    await expect(service(source).importSeedList()).rejects.toBeInstanceOf(SeedListUnavailable);
  });

  it('runs the import when the collector module initialises', async () => {
    await service().onModuleInit();

    expect(await companies.list()).toHaveLength(7);
  });
});
