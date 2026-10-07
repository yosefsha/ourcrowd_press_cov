import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { CompanyProfile, TrackedCompany, TrackedCompanyStatus } from '../domain/company';
import type { Run } from '../domain/run';
import { RUN_QUEUE, RunAlreadyActive, type RunQueue } from '../runs/run-queue';
import {
  DuplicateTrackedCompany,
  TRACKED_COMPANY_REPOSITORY,
  TrackedCompanyNotFound,
  type TrackedCompanyRepository,
  type TrackedCompanyStatusChange,
} from './tracked-company.repository';

/** Why a company sent back from the companies page is in Needs Review. */
export const SENT_TO_REVIEW_REASON = 'Sent back to Needs Review from the companies page.';

export interface CompanyListQuery {
  readonly status?: TrackedCompanyStatus;
  readonly q?: string;
}

/** A Company Profile for a company added by hand; unset optional fields are empty. */
export interface NewCompanyProfile {
  readonly displayName: string;
  readonly aliases?: readonly string[];
  readonly domain?: string | null;
  readonly description?: string | null;
  readonly searchTerms?: readonly string[];
}

/**
 * Managing Tracked Companies from the companies page (ADR-010): listing,
 * adding by hand, editing Company Profiles, the review lifecycle and
 * queueing a Re-process.
 */
@Injectable()
export class CompaniesService {
  constructor(
    @Inject(TRACKED_COMPANY_REPOSITORY) private readonly companies: TrackedCompanyRepository,
    @Inject(RUN_QUEUE) private readonly runQueue: RunQueue,
  ) {}

  list(query: CompanyListQuery): Promise<readonly TrackedCompany[]> {
    return this.companies.list({
      ...(query.status !== undefined && { statuses: [query.status] }),
      ...(query.q !== undefined && { query: query.q }),
    });
  }

  /** Adds a company by hand: it has no Source Name and is collected immediately. */
  async create(profile: NewCompanyProfile): Promise<TrackedCompany> {
    return this.mapErrors(() =>
      this.companies.create({
        sourceName: null,
        status: 'active',
        reviewReason: null,
        profile: {
          displayName: profile.displayName,
          aliases: profile.aliases ?? [],
          domain: profile.domain ?? null,
          description: profile.description ?? null,
          searchTerms: profile.searchTerms ?? [],
        },
      }),
    );
  }

  /**
   * Replaces the given profile fields; an empty change returns the company as
   * it is. A deactivated company is frozen: its profile is kept for audit.
   */
  async update(id: number, changes: Partial<CompanyProfile>): Promise<TrackedCompany> {
    const company = await this.mapErrors(() => this.companies.get(id));
    if (company.status === 'deactivated') {
      throw new ConflictException(`Cannot edit: ${company.profile.displayName} is deactivated`);
    }
    if (Object.keys(changes).length === 0) return company;
    return this.mapErrors(() => this.companies.update(id, changes));
  }

  /** Needs Review → active: a person has checked the profile. */
  markReviewed(id: number): Promise<TrackedCompany> {
    return this.changeStatus(id, ['needs_review'], { status: 'active' }, 'mark as reviewed');
  }

  /** Active → Needs Review: excluded from Runs until reviewed again. */
  sendToReview(id: number): Promise<TrackedCompany> {
    return this.changeStatus(
      id,
      ['active'],
      { status: 'needs_review', reason: SENT_TO_REVIEW_REASON },
      'send to Needs Review',
    );
  }

  /** Never a delete: Candidates and Mentions are kept, and it cannot be reactivated. */
  deactivate(id: number): Promise<TrackedCompany> {
    return this.changeStatus(id, ['active', 'needs_review'], { status: 'deactivated' }, 'deactivate');
  }

  /**
   * Queues a Backfill limited to this company with `reprocess: true`. Only an
   * active company can be re-processed; throws `ConflictException` with the
   * active Run when another Run is queued or running.
   */
  async reprocess(id: number): Promise<Run> {
    const company = await this.mapErrors(() => this.companies.get(id));
    if (company.status !== 'active') {
      throw new ConflictException(
        `Only an active company can be re-processed; ${company.profile.displayName} is ${describeStatus(company.status)}`,
      );
    }
    try {
      return await this.runQueue.enqueue({
        type: 'backfill',
        trigger: 'dashboard',
        params: { until: null, companyIds: [company.id], reprocess: true },
      });
    } catch (error) {
      if (error instanceof RunAlreadyActive) {
        throw new ConflictException({
          message: `Another Run is already ${error.activeRun.status}; re-process once it has finished`,
          activeRun: error.activeRun,
        });
      }
      throw error;
    }
  }

  private async changeStatus(
    id: number,
    allowedFrom: readonly TrackedCompanyStatus[],
    change: TrackedCompanyStatusChange,
    action: string,
  ): Promise<TrackedCompany> {
    const company = await this.mapErrors(() => this.companies.get(id));
    if (!allowedFrom.includes(company.status)) {
      throw new ConflictException(
        `Cannot ${action}: ${company.profile.displayName} is ${describeStatus(company.status)}`,
      );
    }
    return this.mapErrors(() => this.companies.setStatus(id, change));
  }

  /** Turns the repository's errors into HTTP errors whose message names the offending field. */
  private async mapErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof TrackedCompanyNotFound) {
        throw new NotFoundException(`Tracked Company ${error.id} does not exist`);
      }
      if (error instanceof DuplicateTrackedCompany) {
        throw new ConflictException(
          error.field === 'displayName'
            ? [`displayName "${error.value}" is already used by another company that is not deactivated`]
            : [`sourceName "${error.value}" is already used by another company`],
        );
      }
      throw error;
    }
  }
}

function describeStatus(status: TrackedCompanyStatus): string {
  switch (status) {
    case 'active':
      return 'already active';
    case 'needs_review':
      return 'in Needs Review';
    case 'deactivated':
      return 'deactivated';
  }
}
