import type { TrackedCompanyStatus } from '../../domain/company';
import { mentionStatusOf, type MentionStatus } from '../../domain/mention-status';
import type { Sentiment } from '../../domain/sentiment';
import { calendarDateIn } from '../../domain/time-zone';
import type { ArticleRecord, CandidateRecord, CompanyRecord, Snapshot } from '../export-format';
import { csvDocument } from './csv';

/** One Tracked Company's line in `mention-status.json`. */
export interface CompanyMentionStatus {
  readonly companyId: number;
  readonly displayName: string;
  readonly sourceName: string | null;
  readonly companyStatus: TrackedCompanyStatus;
  readonly mentionStatus: MentionStatus;
  /** Publication time of the most recent Mention; null when there is none. */
  readonly lastMentionedAt: string | null;
  readonly mentions: number;
  readonly sentiment: Readonly<Record<Sentiment, number>>;
  readonly rejectedCandidates: number;
  readonly pendingCandidates: number;
  readonly coverageCapped: boolean;
}

/** `mention-status.json`: each company's Mention Status as of the export. */
export interface MentionStatusReport {
  readonly exportedAt: string;
  readonly timeZone: string;
  readonly companies: readonly CompanyMentionStatus[];
}

interface MentionRow {
  readonly company: CompanyRecord;
  readonly article: ArticleRecord;
  readonly candidate: CandidateRecord;
}

function byDisplayName(a: CompanyRecord, b: CompanyRecord): number {
  return a.profile.displayName.localeCompare(b.profile.displayName, 'en') || a.id - b.id;
}

function indexById<T extends { readonly id: number }>(records: readonly T[]): ReadonlyMap<number, T> {
  return new Map(records.map((record) => [record.id, record]));
}

/** Postgres timestamps carry microseconds; they sort correctly as fixed-width UTC text. */
function latest(a: string | null, b: string): string {
  return a === null || b > a ? b : a;
}

/** Every company with its Mention Status, ordered by display name. */
export function mentionStatusReport(snapshot: Snapshot, exportedAt: Date, timeZone: string): MentionStatusReport {
  const articles = indexById(snapshot.articles);
  const companies = [...snapshot.companies].sort(byDisplayName).map((company): CompanyMentionStatus => {
    const own = snapshot.candidates.filter((candidate) => candidate.companyId === company.id);
    const mentions = own.filter((candidate) => candidate.relevance === 'relevant');
    let lastMentionedAt: string | null = null;
    const sentiment: Record<Sentiment, number> = { positive: 0, negative: 0, neutral: 0 };
    for (const mention of mentions) {
      const article = articles.get(mention.articleId);
      if (article !== undefined) lastMentionedAt = latest(lastMentionedAt, article.publishedAt);
      if (mention.sentiment !== null) sentiment[mention.sentiment] += 1;
    }
    return {
      companyId: company.id,
      displayName: company.profile.displayName,
      sourceName: company.sourceName,
      companyStatus: company.status,
      mentionStatus: mentionStatusOf(
        lastMentionedAt === null ? null : new Date(lastMentionedAt),
        exportedAt,
        timeZone,
      ),
      lastMentionedAt,
      mentions: mentions.length,
      sentiment,
      rejectedCandidates: own.filter((candidate) => candidate.relevance === 'rejected').length,
      pendingCandidates: own.filter((candidate) => candidate.relevance === 'pending').length,
      coverageCapped: company.coverageCapped,
    };
  });
  return { exportedAt: exportedAt.toISOString(), timeZone, companies };
}

function isoDate(instant: string, timeZone: string): string {
  const { year, month, day } = calendarDateIn(new Date(instant), timeZone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const MENTIONS_CSV_HEADER = ['company', 'date', 'outlet', 'title', 'url', 'sentiment'] as const;

/**
 * `mentions.csv`: one line per Mention (rejected and pending Candidates are
 * left out), by company display name, newest first. The date is the
 * publication day in `timeZone`; the URL is the Outlet's own when resolved.
 */
export function mentionsCsv(snapshot: Snapshot, timeZone: string): string {
  const companies = indexById(snapshot.companies);
  const articles = indexById(snapshot.articles);
  const rows: MentionRow[] = [];
  for (const candidate of snapshot.candidates) {
    if (candidate.relevance !== 'relevant') continue;
    const company = companies.get(candidate.companyId);
    const article = articles.get(candidate.articleId);
    if (company !== undefined && article !== undefined) rows.push({ company, article, candidate });
  }
  rows.sort(
    (a, b) =>
      byDisplayName(a.company, b.company) ||
      b.article.publishedAt.localeCompare(a.article.publishedAt) ||
      a.candidate.id - b.candidate.id,
  );
  return csvDocument(
    MENTIONS_CSV_HEADER,
    rows.map(({ company, article, candidate }) => [
      company.profile.displayName,
      isoDate(article.publishedAt, timeZone),
      article.outletName,
      article.title,
      article.publisherUrl ?? article.googleUrl,
      candidate.sentiment,
    ]),
  );
}
