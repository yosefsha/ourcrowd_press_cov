import type { TrackedCompany, TrackedCompanyStatus } from '../../domain/company';

/** A Tracked Company as the companies page sees it: its Company Profile flattened beside its lifecycle fields. */
export class AdminCompanyDto {
  readonly id: number;
  readonly sourceName: string | null;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly domain: string | null;
  readonly description: string | null;
  readonly searchTerms: readonly string[];
  readonly status: TrackedCompanyStatus;
  readonly reviewReason: string | null;
  readonly coverageCapped: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(company: TrackedCompany) {
    this.id = company.id;
    this.sourceName = company.sourceName;
    this.displayName = company.profile.displayName;
    this.aliases = company.profile.aliases;
    this.domain = company.profile.domain;
    this.description = company.profile.description;
    this.searchTerms = company.profile.searchTerms;
    this.status = company.status;
    this.reviewReason = company.reviewReason;
    this.coverageCapped = company.coverageCapped;
    this.createdAt = company.createdAt.toISOString();
    this.updatedAt = company.updatedAt.toISOString();
  }
}
