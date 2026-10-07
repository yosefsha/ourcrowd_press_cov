import { Global, type INestApplicationContext, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AMBIGUITY_TRIAGE, type AmbiguityAssessment, type AmbiguityTriage } from '../src/classification/ambiguity-triage';
import { ClassifierUnavailable } from '../src/classification/classifier-errors';
import { CompanyImportModule } from '../src/companies/import/company-import.module';
import { SEED_LIST_SOURCE, type SeedListSource } from '../src/companies/import/seed-list-source';
import {
  DuplicateTrackedCompany,
  TRACKED_COMPANY_REPOSITORY,
  TrackedCompanyNotFound,
  type TrackedCompanyRepository,
} from '../src/companies/tracked-company.repository';
import { AppConfigModule } from '../src/config/app-config.module';
import { DatabaseModule } from '../src/database/database.module';
import { parseSeedList, type SeedCompany } from '../src/domain/seed-line';
import { RUN_QUEUE } from '../src/runs/run-queue';

/** Real Seed List lines (docs/ourcrowd_companies.txt). */
const SEEDS: readonly SeedCompany[] = parseSeedList(
  ['Harvey', 'Lambda (lambda.ai)', 'Quantum Machines', 'Ro', 'Ludeo (formerly Edge)', 'Wave'].join('\n'),
);

/**
 * Verdicts listed explicitly per name: Ollama is not available where these
 * tests were written; they should switch to #6's recorded verdicts.
 */
const VERDICTS: Readonly<Record<string, AmbiguityAssessment>> = {
  Lambda: { ambiguous: true, reason: '"Lambda" is a Greek letter and a programming term used widely in technology news.' },
  'Quantum Machines': { ambiguous: false, reason: 'A distinctive company name.' },
  Ludeo: { ambiguous: false, reason: 'A distinctive company name.' },
};

class ListedTriage implements AmbiguityTriage {
  /** While set, the model is "down" from this name on. */
  unavailableFrom: string | null = null;

  assess(name: string): Promise<AmbiguityAssessment> {
    if (this.unavailableFrom === name) return Promise.reject(new ClassifierUnavailable('connect ECONNREFUSED'));
    const verdict = VERDICTS[name];
    return verdict === undefined ? Promise.reject(new Error(`No verdict listed for ${name}`)) : Promise.resolve(verdict);
  }
}

const triage = new ListedTriage();
const seedList: SeedListSource = { read: () => Promise.resolve(SEEDS) };

/** Supplies the sibling modules' ports until #6 and #8 export them; `overrideProvider` replaces either. */
@Global()
@Module({
  providers: [
    { provide: AMBIGUITY_TRIAGE, useValue: triage },
    { provide: RUN_QUEUE, useValue: {} },
  ],
  exports: [AMBIGUITY_TRIAGE, RUN_QUEUE],
})
class TestPortsModule {}

async function startCollectorImport(): Promise<INestApplicationContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppConfigModule, DatabaseModule, TestPortsModule, CompanyImportModule],
  })
    .overrideProvider(AMBIGUITY_TRIAGE)
    .useValue(triage)
    .overrideProvider(SEED_LIST_SOURCE)
    .useValue(seedList)
    .setLogger({ log: () => undefined, error: () => undefined, warn: () => undefined })
    .compile();
  const context = moduleRef.createNestApplication({ logger: false });
  await context.init();
  return context;
}

interface Row {
  source_name: string;
  display_name: string;
  status: string;
  review_reason: string | null;
}

describe('Seed List import (CompanyImportModule against Postgres)', () => {
  let context: INestApplicationContext | null = null;
  let dataSource: DataSource;

  async function boot(): Promise<void> {
    await context?.close();
    context = await startCollectorImport();
    dataSource = context.get(DataSource);
  }

  async function rows(): Promise<Row[]> {
    return dataSource.query(
      'SELECT source_name, display_name, status, review_reason FROM tracked_companies ORDER BY id',
    );
  }

  async function heartbeat(): Promise<{ state: string; detail: string | null } | undefined> {
    const result: { state: string; detail: string | null }[] = await dataSource.query(
      'SELECT state, detail FROM collector_heartbeat WHERE id = 1',
    );
    return result[0];
  }

  beforeAll(async () => {
    triage.unavailableFrom = 'Quantum Machines';
    await boot();
    await dataSource.query('TRUNCATE "tracked_companies" RESTART IDENTITY CASCADE');
    await dataSource.query('DELETE FROM "collector_heartbeat"');
  });

  afterAll(async () => {
    await dataSource.query('TRUNCATE "tracked_companies" RESTART IDENTITY CASCADE');
    await dataSource.query('DELETE FROM "collector_heartbeat"');
    await context?.close();
  });

  it('on start with an empty table imports until the model is unreachable, then pauses', async () => {
    await boot();

    expect(await rows()).toEqual([
      {
        source_name: 'Harvey',
        display_name: 'Harvey',
        status: 'needs_review',
        review_reason: '"Harvey" is a common first name, so a news search for it would mostly return unrelated people.',
      },
      {
        source_name: 'Lambda (lambda.ai)',
        display_name: 'Lambda',
        status: 'needs_review',
        review_reason: VERDICTS.Lambda?.reason,
      },
    ]);
    const beat = await heartbeat();
    expect(beat?.state).toBe('idle');
    expect(beat?.detail).toContain('Seed List import paused at 2 of 6');
  });

  it('on restart resumes with the lines not yet imported', async () => {
    triage.unavailableFrom = null;
    await boot();

    const imported = await rows();
    expect(imported.map((row) => [row.display_name, row.status])).toEqual([
      ['Harvey', 'needs_review'],
      ['Lambda', 'needs_review'],
      ['Quantum Machines', 'active'],
      ['Ro', 'needs_review'],
      ['Ludeo', 'active'],
      ['Wave', 'needs_review'],
    ]);
    expect(await heartbeat()).toEqual({ state: 'idle', detail: null });
  });

  it('does nothing on a further restart', async () => {
    const before = await rows();
    triage.unavailableFrom = 'Quantum Machines';
    await boot();

    expect(await rows()).toEqual(before);
  });

  describe('PostgresTrackedCompanyRepository', () => {
    function repository(): TrackedCompanyRepository {
      if (context === null) throw new Error('not booted');
      return context.get<TrackedCompanyRepository>(TRACKED_COMPANY_REPOSITORY);
    }

    it('filters by ids and status together', async () => {
      const all = await repository().list();
      const ids = all.slice(0, 3).map((company) => company.id);

      const filtered = await repository().list({ ids, statuses: ['needs_review'] });

      expect(filtered.map((company) => company.profile.displayName)).toEqual(['Harvey', 'Lambda']);
      expect(await repository().list({ ids: [] })).toEqual([]);
    });

    it('records whether coverage was capped', async () => {
      const [company] = await repository().list({ query: 'Quantum' });
      if (company === undefined) throw new Error('missing');

      await repository().recordCoverageCapped(company.id, true);

      await expect(repository().get(company.id)).resolves.toMatchObject({ coverageCapped: true });
      await expect(repository().recordCoverageCapped(99999, true)).rejects.toBeInstanceOf(TrackedCompanyNotFound);
    });

    it('rejects a duplicate Source Name and a clashing re-activation', async () => {
      await expect(
        repository().create({
          sourceName: 'Wave',
          status: 'active',
          reviewReason: null,
          profile: { displayName: 'Wave Two', aliases: [], domain: null, description: null, searchTerms: [] },
        }),
      ).rejects.toEqual(new DuplicateTrackedCompany('sourceName', 'Wave'));

      const [ludeo] = await repository().list({ query: 'Ludeo' });
      if (ludeo === undefined) throw new Error('missing');
      await repository().setStatus(ludeo.id, { status: 'deactivated' });
      await repository().create({
        sourceName: null,
        status: 'active',
        reviewReason: null,
        profile: { displayName: 'ludeo', aliases: [], domain: null, description: null, searchTerms: [] },
      });
      await expect(repository().setStatus(ludeo.id, { status: 'active' })).rejects.toBeInstanceOf(
        DuplicateTrackedCompany,
      );
    });
  });
});
