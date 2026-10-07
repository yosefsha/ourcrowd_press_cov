import type { CompanyProfile, TrackedCompany, TrackedCompanyStatus } from '../domain/company';

/** Injection token for the `TrackedCompanyRepository` port. */
export const TRACKED_COMPANY_REPOSITORY = Symbol('TRACKED_COMPANY_REPOSITORY');

/** Narrows a listing; every field left out matches everything. */
export interface TrackedCompanyFilter {
  readonly statuses?: readonly TrackedCompanyStatus[];
  readonly ids?: readonly number[];
  /** Case-insensitive match on display name, aliases or Source Name. */
  readonly query?: string;
}

/** A Tracked Company to create: from the Seed List (with its line) or by hand (`sourceName: null`). */
export interface NewTrackedCompany {
  readonly sourceName: string | null;
  readonly profile: CompanyProfile;
  readonly status: Exclude<TrackedCompanyStatus, 'deactivated'>;
  readonly reviewReason: string | null;
}

/** A change of lifecycle state. Sending a company to Needs Review needs a reason. */
export type TrackedCompanyStatusChange =
  | { readonly status: 'active' }
  | { readonly status: 'needs_review'; readonly reason: string }
  | { readonly status: 'deactivated' };

/**
 * The Tracked Companies and their Company Profiles (ADR-010). The Source Name
 * is fixed at creation; there is no delete — companies are deactivated.
 */
export interface TrackedCompanyRepository {
  /** Ordered by display name. */
  list(filter?: TrackedCompanyFilter): Promise<readonly TrackedCompany[]>;
  /** Throws `TrackedCompanyNotFound`. */
  get(id: number): Promise<TrackedCompany>;
  /** Throws `DuplicateTrackedCompany` on a clashing display name or Source Name. */
  create(company: NewTrackedCompany): Promise<TrackedCompany>;
  /** Replaces the given profile fields. Throws `TrackedCompanyNotFound` or `DuplicateTrackedCompany`. */
  update(id: number, changes: Partial<CompanyProfile>): Promise<TrackedCompany>;
  /** Throws `TrackedCompanyNotFound`, or `DuplicateTrackedCompany` when re-activating clashes. */
  setStatus(id: number, change: TrackedCompanyStatusChange): Promise<TrackedCompany>;
  /** Records whether the company's latest collection hit a result cap. Throws `TrackedCompanyNotFound`. */
  recordCoverageCapped(id: number, capped: boolean): Promise<void>;
}

export class TrackedCompanyNotFound extends Error {
  constructor(readonly id: number) {
    super(`Tracked Company ${id} does not exist`);
    this.name = 'TrackedCompanyNotFound';
  }
}

/**
 * Another Tracked Company that is not deactivated already has this display
 * name (case-insensitive), or another company has this Source Name.
 */
export class DuplicateTrackedCompany extends Error {
  constructor(
    readonly field: 'displayName' | 'sourceName',
    readonly value: string,
  ) {
    super(`A Tracked Company with ${field} "${value}" already exists`);
    this.name = 'DuplicateTrackedCompany';
  }
}
