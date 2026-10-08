import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  CoverageWindowInFuture,
  InvalidCoverageWindow,
  ROLLING_WINDOW_DAYS,
  formatCoverageWindow,
  parseCoverageWindow,
  resolveCoverageWindow,
  type CoverageWindow,
} from '../domain/coverage-window';
import type { DateRange } from '../domain/date-range';
import { MENTION_STATUSES, mentionStatusOf, type MentionStatus } from '../domain/mention-status';
import { articleLink, safeHttpUrl } from './article-links';
import { orderCompanies } from './company-ordering';
import {
  COVERAGE_READ_MODEL,
  CoverageCompanyNotFound,
  CoverageDataUnavailable,
  type CollectionTimeline,
  type CompanyCoverage,
  type CoverageArticle,
  type CoverageCandidate,
  type CoverageReadModel,
} from './coverage-read-model';
import { COVERAGE_CLOCK, COVERAGE_SETTINGS, type Clock, type CoverageSettings } from './coverage-settings';
import { ArticleDto } from './dto/article.dto';
import { CandidatePageDto } from './dto/candidate-page.dto';
import { CandidateDto } from './dto/candidate.dto';
import type { CandidatesQueryDto } from './dto/candidates-query.dto';
import type { CompaniesQueryDto } from './dto/companies-query.dto';
import { CompanyDetailDto } from './dto/company-detail.dto';
import { CompanyOverviewRowDto } from './dto/company-overview-row.dto';
import { CoverageSummaryDto } from './dto/coverage-summary.dto';
import { HeadlineDto } from './dto/headline.dto';
import { WeeklySentimentPointDto } from './dto/weekly-sentiment-point.dto';
import { contiguousWeeklySeries } from './weekly-series';

const MS_PER_DAY = 86_400_000;

/** A Coverage Window resolved against the current time. */
interface ResolvedWindow {
  readonly window: CoverageWindow;
  readonly period: DateRange;
}

/** A company's coverage with its Mention Status as of now. */
interface RatedCoverage extends CompanyCoverage {
  readonly mentionStatus: MentionStatus;
  readonly negativeCount: number;
}

/**
 * The dashboard's read model: summary strip, overview rows, company detail
 * and Candidate lists for a Coverage Window. Mention Status is always as of
 * now, independent of the window.
 */
@Injectable()
export class CoverageService {
  constructor(
    @Inject(COVERAGE_READ_MODEL) private readonly readModel: CoverageReadModel,
    @Inject(COVERAGE_CLOCK) private readonly clock: Clock,
    @Inject(COVERAGE_SETTINGS) private readonly settings: CoverageSettings,
  ) {}

  async summary(windowKey: string): Promise<CoverageSummaryDto> {
    const now = this.clock.now();
    const { window, period } = this.resolveWindow(windowKey, now);
    const [companies, timeline] = await this.read(() =>
      Promise.all([
        this.readModel.listActiveCompanyCoverage(period, null),
        this.readModel.collectionTimeline(),
      ]),
    );
    const rated = companies.map((company) => this.rate(company, now));

    const byStatus = Object.fromEntries(MENTION_STATUSES.map((status) => [status, 0])) as Record<
      MentionStatus,
      number
    >;
    const sentiment = { positive: 0, negative: 0, neutral: 0 };
    let mentionCount = 0;
    let companiesWithNegativeMentions = 0;
    for (const company of rated) {
      byStatus[company.mentionStatus] += 1;
      mentionCount += company.mentionCount;
      sentiment.positive += company.sentiment.positive;
      sentiment.negative += company.sentiment.negative;
      sentiment.neutral += company.sentiment.neutral;
      if (company.negativeCount > 0) companiesWithNegativeMentions += 1;
    }

    return new CoverageSummaryDto({
      window: formatCoverageWindow(window),
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      asOf: timeline.lastRefreshedAt?.toISOString() ?? null,
      collectionStartedAt: collectionStartedAt(timeline)?.toISOString() ?? null,
      companiesByMentionStatus: byStatus,
      mentionCount,
      sentiment,
      companiesWithNegativeMentions,
    });
  }

  async listCompanies(query: CompaniesQueryDto): Promise<CompanyOverviewRowDto[]> {
    const now = this.clock.now();
    const { period } = this.resolveWindow(query.window, now);
    const nameQuery = query.q === undefined || query.q === '' ? null : query.q;
    const companies = await this.read(() => this.readModel.listActiveCompanyCoverage(period, nameQuery));

    const matching = companies
      .map((company) => this.rate(company, now))
      .filter((company) => query.status === undefined || company.mentionStatus === query.status)
      .filter((company) => query.hasNegatives === undefined || company.negativeCount > 0 === query.hasNegatives);

    return orderCompanies(matching, query.sort).map(
      (company) =>
        new CompanyOverviewRowDto({
          id: company.companyId,
          displayName: company.displayName,
          mentionStatus: company.mentionStatus,
          lastMentionAt: company.lastMentionAt?.toISOString() ?? null,
          mentionCount: company.mentionCount,
          capped: company.capped,
          sentiment: company.sentiment,
          latestHeadline: toHeadline(company.latestMention),
        }),
    );
  }

  async getCompany(companyId: number, windowKey: string): Promise<CompanyDetailDto> {
    const now = this.clock.now();
    const { window, period } = this.resolveWindow(windowKey, now);
    const timeZone = this.settings.timeZone;
    const [detail, weekly] = await this.read(() =>
      Promise.all([
        this.readModel.getCompanyCoverage(companyId, period),
        this.readModel.weeklyMentionCounts(companyId, period, timeZone),
      ]),
    );
    const classified = detail.relevantCandidates + detail.rejectedCandidates;

    return new CompanyDetailDto({
      id: detail.company.id,
      sourceName: detail.company.sourceName,
      status: detail.company.status,
      profile: detail.company.profile,
      window: formatCoverageWindow(window),
      mentionStatus: mentionStatusOf(detail.lastMentionAt, now, timeZone),
      lastMentionAt: detail.lastMentionAt?.toISOString() ?? null,
      mentionCount: detail.mentionCount,
      capped: detail.capped,
      sentiment: detail.sentiment,
      weeklySeries: contiguousWeeklySeries(period, weekly, timeZone).map(
        (point) => new WeeklySentimentPointDto({ weekStart: point.weekStart, ...point.sentiment }),
      ),
      rejectionRate: classified === 0 ? null : detail.rejectedCandidates / classified,
    });
  }

  async listCandidates(companyId: number, query: CandidatesQueryDto): Promise<CandidatePageDto> {
    const { period } = this.resolveWindow(query.window, this.clock.now());
    const slice = await this.read(() =>
      this.readModel.listCandidates(companyId, period, query.include, {
        offset: (query.page - 1) * query.pageSize,
        limit: query.pageSize,
      }),
    );
    return new CandidatePageDto({
      items: slice.items.map(toCandidateDto),
      total: slice.total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /** Parses and resolves `?window=`; a malformed or not-yet-started window is a 400. */
  private resolveWindow(windowKey: string, now: Date): ResolvedWindow {
    try {
      const window = parseCoverageWindow(windowKey);
      return { window, period: resolveCoverageWindow(window, now, this.settings.timeZone) };
    } catch (error) {
      if (error instanceof InvalidCoverageWindow || error instanceof CoverageWindowInFuture) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private rate(company: CompanyCoverage, now: Date): RatedCoverage {
    return {
      ...company,
      mentionStatus: mentionStatusOf(company.lastMentionAt, now, this.settings.timeZone),
      negativeCount: company.sentiment.negative,
    };
  }

  /** Maps the read model's failures to HTTP errors. */
  private async read<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CoverageCompanyNotFound) throw new NotFoundException(error.message);
      if (error instanceof CoverageDataUnavailable) {
        throw new ServiceUnavailableException('Coverage data is temporarily unavailable');
      }
      throw error;
    }
  }
}

/**
 * The earliest moment collection covers: the start of the first Backfill's
 * window (a Backfill collects the rolling Coverage Window before it), or the
 * first Candidate fetch if that is earlier.
 */
export function collectionStartedAt(timeline: CollectionTimeline): Date | null {
  const backfillWindowStart =
    timeline.firstBackfillStartedAt === null
      ? null
      : new Date(timeline.firstBackfillStartedAt.getTime() - ROLLING_WINDOW_DAYS * MS_PER_DAY);
  const candidates = [backfillWindowStart, timeline.firstCandidateFetchedAt].filter(
    (instant): instant is Date => instant !== null,
  );
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((instant) => instant.getTime())));
}

function toHeadline(article: CoverageArticle | null): HeadlineDto | null {
  if (article === null) return null;
  const url = articleLink(article);
  if (url === null) return null;
  return new HeadlineDto({
    title: article.title,
    outletName: article.outletName,
    url,
    publishedAt: article.publishedAt.toISOString(),
  });
}

function toArticleDto(article: CoverageArticle): ArticleDto {
  return new ArticleDto({
    id: article.id,
    title: article.title,
    snippet: article.snippet,
    outletName: article.outletName,
    outletUrl: safeHttpUrl(article.outletUrl) ?? '',
    googleUrl: safeHttpUrl(article.googleUrl) ?? '',
    publisherUrl: safeHttpUrl(article.publisherUrl),
    publishedAt: article.publishedAt.toISOString(),
    language: article.language,
    edition: article.edition,
  });
}

function toCandidateDto(candidate: CoverageCandidate): CandidateDto {
  return new CandidateDto({
    id: candidate.id,
    article: toArticleDto(candidate.article),
    relevance: candidate.relevance,
    relevanceMethod: candidate.relevanceMethod,
    relevanceReason: candidate.relevanceReason,
    sentiment: candidate.sentiment,
    sentimentReason: candidate.sentimentReason,
    confirmedAt: candidate.confirmedAt?.toISOString() ?? null,
  });
}
