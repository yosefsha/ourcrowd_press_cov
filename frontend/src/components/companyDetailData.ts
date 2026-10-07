/**
 * Pure presentation logic for the Company detail panel: chart data mapping,
 * headline link choice and label formatting. No React, no I/O.
 */
import type { Article, Candidate, MentionStatus, RelevanceMethod, Sentiment, WeeklySentimentPoint } from '../types.ts';

/** One bar of the Weekly Mentions chart. */
export interface WeeklyChartDatum {
  readonly weekStart: string;
  /** Short axis label, e.g. `Oct 5`. */
  readonly label: string;
  readonly positive: number;
  readonly negative: number;
  readonly neutral: number;
  readonly total: number;
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const weekLabelFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function parseIsoDate(value: string): number {
  const match = ISO_DATE.exec(value);
  if (match === null) throw new RangeError(`Expected a YYYY-MM-DD week start, got "${value}"`);
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function toIsoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * Maps the API's weekly series to chart rows: sorted by week, with weeks the
 * API left out (no Mentions) filled in as zeros so the time axis stays even.
 * Throws on a malformed week start, or one off the weekly grid, rather than
 * plotting it in the wrong place or dropping it.
 */
export function toWeeklyChartData(series: readonly WeeklySentimentPoint[]): WeeklyChartDatum[] {
  if (series.length === 0) return [];
  const byWeek = new Map<number, WeeklySentimentPoint>();
  for (const point of series) byWeek.set(parseIsoDate(point.weekStart), point);

  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const first = weeks[0] ?? 0;
  const last = weeks[weeks.length - 1] ?? first;
  const misaligned = weeks.find((week) => (week - first) % WEEK_MS !== 0);
  if (misaligned !== undefined) {
    // Filling the gaps would step past this week and silently drop its counts.
    throw new RangeError(`Week start ${toIsoDate(misaligned)} is not a whole number of weeks after ${toIsoDate(first)}`);
  }

  const rows: WeeklyChartDatum[] = [];
  for (let week = first; week <= last; week += WEEK_MS) {
    const point = byWeek.get(week);
    const positive = point?.positive ?? 0;
    const negative = point?.negative ?? 0;
    const neutral = point?.neutral ?? 0;
    rows.push({
      weekStart: toIsoDate(week),
      label: weekLabelFormat.format(week),
      positive,
      negative,
      neutral,
      total: positive + negative + neutral,
    });
  }
  return rows;
}

/** Only web links are rendered as anchors; anything else (e.g. `javascript:`) is dropped. */
function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * The link for a headline: the Outlet's own URL once resolved, else the Google
 * News link. Null when neither is a usable http(s) URL.
 */
export function articleHref(article: Pick<Article, 'publisherUrl' | 'googleUrl'>): string | null {
  if (article.publisherUrl !== null && isWebUrl(article.publisherUrl)) return article.publisherUrl;
  return isWebUrl(article.googleUrl) ? article.googleUrl : null;
}

/** A rejection rate at or above this share suggests the Company Profile matches the wrong articles. */
export const HIGH_REJECTION_RATE = 0.5;

export function isHighRejectionRate(rate: number): boolean {
  return rate >= HIGH_REJECTION_RATE;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** `2026-10-05T08:00:00Z` → `Oct 5, 2026`. */
export function formatDate(isoDateTime: string): string {
  const epoch = Date.parse(isoDateTime);
  return Number.isNaN(epoch) ? isoDateTime : dateFormat.format(epoch);
}

export const SENTIMENT_LABELS: Readonly<Record<Sentiment, string>> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
};

/** Diverging encoding: blue and red poles, gray midpoint (validated for contrast and CVD separation). */
export const SENTIMENT_COLORS: Readonly<Record<Sentiment, string>> = {
  positive: '#2a6fdb',
  neutral: '#8b8b86',
  negative: '#d0443a',
};

export const RELEVANCE_METHOD_LABELS: Readonly<Record<RelevanceMethod, string>> = {
  llm: 'LLM',
  name_absent: 'Name absent',
};

/** The classifier reason shown on a row: the Sentiment reason for a Mention, the Relevance reason otherwise. */
export function candidateReason(candidate: Candidate): string | null {
  return candidate.relevance === 'relevant' ? candidate.sentimentReason : candidate.relevanceReason;
}

/** Number of pages for `total` items; at least 1 so an empty list still reads "page 1 of 1". */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Mentions per page in the detail panel's list. */
export const CANDIDATES_PAGE_SIZE = 20;

export const MENTION_STATUS_LABELS: Readonly<Record<MentionStatus, string>> = {
  active: 'Active',
  recent: 'Recent',
  quiet: 'Quiet',
  no_coverage: 'No coverage',
};

/** Mentions in the window; `100+` style when the News Source's result cap was hit. */
export function formatMentionCount(count: number, capped: boolean): string {
  return capped ? `${count}+` : String(count);
}
