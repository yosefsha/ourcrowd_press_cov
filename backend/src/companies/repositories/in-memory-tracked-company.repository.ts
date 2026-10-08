import type { CompanyProfile, TrackedCompany } from '../../domain/company';
import {
  DuplicateTrackedCompany,
  NewTrackedCompany,
  TrackedCompanyFilter,
  TrackedCompanyNotFound,
  TrackedCompanyRepository,
  TrackedCompanyStatusChange,
} from '../tracked-company.repository';

/**
 * In-memory `TrackedCompanyRepository` for tests. Enforces the same uniqueness
 * rules as the Postgres indexes: Source Names are unique, display names are
 * unique (case-insensitive) among companies that are not deactivated.
 */
export class InMemoryTrackedCompanyRepository implements TrackedCompanyRepository {
  private readonly companies = new Map<number, TrackedCompany>();
  private nextId = 1;

  constructor(
    /** Clock for `createdAt` / `updatedAt`; injectable so tests can pin it. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(filter: TrackedCompanyFilter = {}): Promise<readonly TrackedCompany[]> {
    const text = filter.query?.trim().toLowerCase() ?? '';
    const matches = [...this.companies.values()].filter(
      (company) =>
        (filter.statuses === undefined || filter.statuses.includes(company.status)) &&
        (filter.ids === undefined || filter.ids.includes(company.id)) &&
        (text === '' || searchableNames(company).some((name) => name.toLowerCase().includes(text))),
    );
    matches.sort(
      (a, b) =>
        a.profile.displayName.toLowerCase().localeCompare(b.profile.displayName.toLowerCase()) || a.id - b.id,
    );
    return Promise.resolve(matches);
  }

  get(id: number): Promise<TrackedCompany> {
    return Promise.resolve(this.find(id));
  }

  create(company: NewTrackedCompany): Promise<TrackedCompany> {
    const timestamp = this.now();
    const created: TrackedCompany = {
      id: this.nextId,
      sourceName: company.sourceName,
      status: company.status,
      reviewReason: company.reviewReason,
      coverageCapped: false,
      profile: copyProfile(company.profile),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.assertUnique(created);
    this.nextId += 1;
    this.companies.set(created.id, created);
    return Promise.resolve(created);
  }

  update(id: number, changes: Partial<CompanyProfile>): Promise<TrackedCompany> {
    const current = this.find(id);
    return Promise.resolve(
      this.replace({ ...current, profile: copyProfile({ ...current.profile, ...definedOnly(changes) }) }),
    );
  }

  setStatus(id: number, change: TrackedCompanyStatusChange): Promise<TrackedCompany> {
    const current = this.find(id);
    return Promise.resolve(
      this.replace({
        ...current,
        status: change.status,
        reviewReason: change.status === 'needs_review' ? change.reason : null,
      }),
    );
  }

  recordCoverageCapped(id: number, capped: boolean): Promise<void> {
    this.replace({ ...this.find(id), coverageCapped: capped });
    return Promise.resolve();
  }

  private find(id: number): TrackedCompany {
    const company = this.companies.get(id);
    if (company === undefined) throw new TrackedCompanyNotFound(id);
    return company;
  }

  private replace(company: TrackedCompany): TrackedCompany {
    const updated: TrackedCompany = { ...company, updatedAt: this.now() };
    this.assertUnique(updated);
    this.companies.set(updated.id, updated);
    return updated;
  }

  private assertUnique(candidate: TrackedCompany): void {
    for (const other of this.companies.values()) {
      if (other.id === candidate.id) continue;
      if (candidate.sourceName !== null && other.sourceName === candidate.sourceName) {
        throw new DuplicateTrackedCompany('sourceName', candidate.sourceName);
      }
      if (
        candidate.status !== 'deactivated' &&
        other.status !== 'deactivated' &&
        other.profile.displayName.toLowerCase() === candidate.profile.displayName.toLowerCase()
      ) {
        throw new DuplicateTrackedCompany('displayName', candidate.profile.displayName);
      }
    }
  }
}

function searchableNames(company: TrackedCompany): readonly string[] {
  return [company.profile.displayName, ...company.profile.aliases, ...(company.sourceName === null ? [] : [company.sourceName])];
}

function copyProfile(profile: CompanyProfile): CompanyProfile {
  return { ...profile, aliases: [...profile.aliases], searchTerms: [...profile.searchTerms] };
}

function definedOnly(changes: Partial<CompanyProfile>): Partial<CompanyProfile> {
  return Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
}
