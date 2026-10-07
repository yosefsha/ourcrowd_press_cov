/** Lifecycle of a Tracked Company (ADR-010). `needs_review` blocks collection. */
export const TRACKED_COMPANY_STATUSES = ['active', 'needs_review', 'deactivated'] as const;
export type TrackedCompanyStatus = (typeof TRACKED_COMPANY_STATUSES)[number];

/** The editable context that identifies a Tracked Company in the press. */
export interface CompanyProfile {
  readonly displayName: string;
  /** Other names the company is written about under, former names included. */
  readonly aliases: readonly string[];
  readonly domain: string | null;
  readonly description: string | null;
  readonly searchTerms: readonly string[];
}

/** A company whose press coverage is monitored. */
export interface TrackedCompany {
  readonly id: number;
  /** The exact Seed List line; null for companies added by hand. Never changes. */
  readonly sourceName: string | null;
  readonly status: TrackedCompanyStatus;
  /** Why the company was judged possibly ambiguous. */
  readonly reviewReason: string | null;
  /** The last collection hit the News Source's result cap or `MAX_CANDIDATES_PER_COMPANY`. */
  readonly coverageCapped: boolean;
  readonly profile: CompanyProfile;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
