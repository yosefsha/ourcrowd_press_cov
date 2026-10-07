import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { AMBIGUITY_TRIAGE, type AmbiguityAssessment, type AmbiguityTriage } from '../../classification/ambiguity-triage';
import { ClassifierOutputInvalid, ClassifierUnavailable } from '../../classification/classifier-errors';
import type { SeedCompany } from '../../domain/seed-line';
import {
  DuplicateTrackedCompany,
  TRACKED_COMPANY_REPOSITORY,
  type TrackedCompanyRepository,
} from '../tracked-company.repository';
import { assessNameByRules } from './ambiguity-rules';
import { SEED_IMPORT_PROGRESS, type SeedImportProgress } from './seed-import-progress';
import { SEED_LIST_SOURCE, type SeedListSource } from './seed-list-source';

export type SeedImportResult =
  /** Nothing to do: the Seed List was imported before, or companies were added by hand. */
  | { readonly outcome: 'skipped' }
  | { readonly outcome: 'completed'; readonly imported: number; readonly needsReview: number }
  /** Ollama could not be reached; the next start resumes with the companies not yet imported. */
  | { readonly outcome: 'halted'; readonly imported: number; readonly needsReview: number; readonly reason: string };

/**
 * The one-time Seed List import with ambiguity triage (ADR-010), run as the
 * collector starts — before anything starts in `onApplicationBootstrap`, so
 * no Run sees a half-imported list.
 *
 * It imports only into a table holding nothing but Seed List companies, and
 * only the lines not imported yet: an empty table gets the whole list, and a
 * restart after an interrupted import resumes where it stopped. Once any
 * company has been added by hand, or every line is in, it does nothing.
 *
 * Each company is triaged by the rules first and, if they pass it, by the
 * `AmbiguityTriage` model. Flagged by either → Needs Review with the reason;
 * otherwise active. An unreadable model answer counts as a flag (errs toward
 * a review); an unreachable model halts the import until the next start.
 */
@Injectable()
export class SeedImportService implements OnModuleInit {
  private readonly logger = new Logger(SeedImportService.name);

  constructor(
    @Inject(TRACKED_COMPANY_REPOSITORY) private readonly companies: TrackedCompanyRepository,
    @Inject(SEED_LIST_SOURCE) private readonly seedList: SeedListSource,
    @Inject(AMBIGUITY_TRIAGE) private readonly triage: AmbiguityTriage,
    @Inject(SEED_IMPORT_PROGRESS) private readonly progress: SeedImportProgress,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.importSeedList();
  }

  async importSeedList(): Promise<SeedImportResult> {
    const existing = await this.companies.list();
    if (existing.some((company) => company.sourceName === null)) return { outcome: 'skipped' };

    const seeds = await this.seedList.read();
    const imported = new Set(existing.map((company) => company.sourceName));
    if (existing.length > 0 && !seeds.some((seed) => imported.has(seed.sourceName))) {
      // The table holds companies from a different Seed List: never mix two.
      this.logger.warn('Tracked Companies exist that are not on the Seed List; the import is skipped');
      return { outcome: 'skipped' };
    }
    const pending = seeds.filter((seed) => !imported.has(seed.sourceName));
    if (pending.length === 0) return { outcome: 'skipped' };

    const total = seeds.length;
    let done = total - pending.length;
    let added = 0;
    let needsReview = 0;
    this.logger.log(
      done === 0
        ? `Importing the Seed List: ${total} companies`
        : `Resuming the Seed List import: ${pending.length} of ${total} companies left`,
    );
    await this.progress.importing({ imported: done, total });

    try {
      for (const seed of pending) {
        const assessment = await this.assess(seed);
        if (await this.insert(seed, assessment)) {
          added += 1;
          if (assessment.ambiguous) needsReview += 1;
        }
        done += 1;
        await this.progress.importing({ imported: done, total });
      }
    } catch (error) {
      if (!(error instanceof ClassifierUnavailable)) {
        await this.progress.stopped(`Seed List import failed at ${done} of ${total}: ${errorMessage(error)}`);
        throw error;
      }
      const reason = `Seed List import paused at ${done} of ${total}: the ambiguity triage model is unavailable (${error.message}). The next collector start resumes it.`;
      this.logger.error(reason);
      await this.progress.stopped(reason);
      return { outcome: 'halted', imported: added, needsReview, reason };
    }

    this.logger.log(`Seed List imported: ${added} companies, ${needsReview} in Needs Review`);
    await this.progress.stopped(null);
    return { outcome: 'completed', imported: added, needsReview };
  }

  private async assess(seed: SeedCompany): Promise<AmbiguityAssessment> {
    const byRule = assessNameByRules(seed.displayName);
    if (byRule !== null) return byRule;
    try {
      return await this.triage.assess(seed.displayName);
    } catch (error) {
      if (error instanceof ClassifierOutputInvalid) {
        return {
          ambiguous: true,
          reason: 'The ambiguity triage gave an answer that could not be read, so the profile needs a person to check it.',
        };
      }
      throw error;
    }
  }

  /** False when the company clashes with one already there (it is skipped, with a warning). */
  private async insert(seed: SeedCompany, assessment: AmbiguityAssessment): Promise<boolean> {
    try {
      await this.companies.create({
        sourceName: seed.sourceName,
        status: assessment.ambiguous ? 'needs_review' : 'active',
        reviewReason: assessment.ambiguous ? assessment.reason : null,
        profile: {
          displayName: seed.displayName,
          aliases: seed.aliases,
          domain: seed.domain,
          description: null,
          searchTerms: [],
        },
      });
      return true;
    } catch (error) {
      if (!(error instanceof DuplicateTrackedCompany)) throw error;
      this.logger.warn(`Seed List line "${seed.sourceName}" skipped: ${error.message}`);
      return false;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
