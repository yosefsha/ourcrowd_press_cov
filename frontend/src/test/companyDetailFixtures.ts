/**
 * TEST-ONLY placeholder fixtures for the Company detail panel.
 *
 * The coverage read API (#11) does not exist yet, so these responses could not
 * be recorded from the real API. They are minimal, typed against the contract
 * in `types.ts`, and use a real Seed List company name. Replace them with
 * responses recorded from the real API once #11 lands (ADR-006).
 *
 * Imported only by tests; nothing in the running app may import this file.
 */
import type { Candidate, CompanyDetail, Page } from '../types.ts';

export function buildCompanyDetail(overrides: Partial<CompanyDetail> = {}): CompanyDetail {
  return {
    id: 6,
    sourceName: 'Harvey',
    status: 'active',
    profile: {
      displayName: 'Harvey',
      aliases: ['Harvey AI'],
      domain: 'harvey.ai',
      description: 'Generative AI platform for legal professionals.',
      searchTerms: ['"Harvey AI"', 'Harvey legal AI'],
    },
    window: 'rolling90',
    mentionStatus: 'active',
    lastMentionAt: '2026-10-05T08:00:00.000Z',
    mentionCount: 3,
    capped: false,
    sentiment: { positive: 2, negative: 1, neutral: 0 },
    weeklySeries: [
      { weekStart: '2026-09-21', positive: 1, negative: 0, neutral: 0 },
      { weekStart: '2026-10-05', positive: 1, negative: 1, neutral: 0 },
    ],
    rejectionRate: 0.25,
    ...overrides,
  };
}

let nextId = 1000;

export function buildMention(overrides: Partial<Candidate> = {}, articleOverrides: Partial<Candidate['article']> = {}): Candidate {
  const id = nextId++;
  return {
    id,
    article: {
      id,
      title: `Harvey headline ${id}`,
      snippet: '',
      outletName: 'Example Outlet',
      outletUrl: 'https://outlet.example',
      googleUrl: `https://news.google.com/rss/articles/${id}`,
      publisherUrl: `https://outlet.example/articles/${id}`,
      publishedAt: '2026-10-05T08:00:00.000Z',
      language: 'en',
      edition: 'en-US',
      ...articleOverrides,
    },
    relevance: 'relevant',
    relevanceMethod: 'llm',
    relevanceReason: 'The article is about the legal AI company Harvey.',
    sentiment: 'positive',
    sentimentReason: 'Reports a new funding round.',
    confirmedAt: '2026-10-05T09:00:00.000Z',
    ...overrides,
  };
}

export function buildRejected(overrides: Partial<Candidate> = {}): Candidate {
  return buildMention({
    relevance: 'rejected',
    relevanceMethod: 'name_absent',
    relevanceReason: 'The company name does not appear in the title or snippet.',
    sentiment: null,
    sentimentReason: null,
    confirmedAt: null,
    ...overrides,
  });
}

export function buildPage<T>(items: readonly T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}
