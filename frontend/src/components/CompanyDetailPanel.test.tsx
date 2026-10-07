import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../api.ts';
import { ApiClientContext } from '../apiClientContext.ts';
import { ApiError } from '../apiErrors.ts';
import { buildCompanyDetail, buildMention, buildPage, buildRejected } from '../test/companyDetailFixtures.ts';
import { createFakeApiClient } from '../test/fixtures.ts';
import type { CandidatesQuery } from '../types.ts';
import { CompanyDetailPanel } from './CompanyDetailPanel.tsx';

class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
});

function renderPanel(overrides: Partial<ApiClient>, onClose: () => void = vi.fn()): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <ApiClientContext.Provider value={createFakeApiClient(overrides)}>
        <QueryClientProvider client={queryClient}>
          <CompanyDetailPanel companyId={6} coverageWindow="2026-Q3" onClose={onClose} />
        </QueryClientProvider>
      </ApiClientContext.Provider>
    </MemoryRouter>,
  );
}

describe('CompanyDetailPanel', () => {
  it('shows the header and requests detail for the selected Coverage Window', async () => {
    const getCompany = vi.fn<ApiClient['getCompany']>().mockResolvedValue(buildCompanyDetail());
    renderPanel({ getCompany, listCompanyCandidates: () => Promise.resolve(buildPage([])) });

    expect(await screen.findByRole('heading', { level: 2, name: 'Harvey' })).toBeInTheDocument();
    expect(getCompany).toHaveBeenCalledWith(6, { window: '2026-Q3' });
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('hints at reviewing the profile when the rejection rate is high', async () => {
    renderPanel({
      getCompany: () => Promise.resolve(buildCompanyDetail({ rejectionRate: 0.8 })),
      listCompanyCandidates: () => Promise.resolve(buildPage([])),
    });
    expect(await screen.findByRole('note')).toHaveTextContent("consider reviewing this company's profile");
  });

  it('shows the Company Profile read-only with a link to edit it', async () => {
    renderPanel({
      getCompany: () => Promise.resolve(buildCompanyDetail()),
      listCompanyCandidates: () => Promise.resolve(buildPage([])),
    });
    const profile = await screen.findByRole('region', { name: 'Company Profile' });
    expect(within(profile).getByText('Harvey AI')).toBeInTheDocument();
    expect(within(profile).getByText('"Harvey AI", Harvey legal AI')).toBeInTheDocument();
    expect(within(profile).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(profile).getByRole('link', { name: 'Edit on Companies page' })).toHaveAttribute(
      'href',
      '/companies?company=6',
    );
  });

  it('renders the weekly chart table from the mapped series', async () => {
    renderPanel({
      getCompany: () => Promise.resolve(buildCompanyDetail()),
      listCompanyCandidates: () => Promise.resolve(buildPage([])),
    });
    const chart = await screen.findByRole('region', { name: 'Weekly Mentions' });
    const rows = within(chart).getAllByRole('row');
    // Header + three weeks (the empty middle week is filled in).
    expect(rows).toHaveLength(4);
    expect(within(chart).getByRole('rowheader', { name: 'Sep 28' })).toBeInTheDocument();
  });

  it('shows an error when the company cannot be loaded, and still closes', async () => {
    const onClose = vi.fn();
    renderPanel({ getCompany: () => Promise.reject(new ApiError(404, 'Company 6 not found', null)) }, onClose);
    expect(await screen.findByRole('alert')).toHaveTextContent('Company 6 not found');
    fireEvent.click(screen.getByRole('button', { name: 'Close company detail' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('Mention list', () => {
  it('links the headline to the publisher, else to Google News, in a new tab', async () => {
    const resolved = buildMention({}, { title: 'Harvey raises Series F', publisherUrl: 'https://outlet.example/f' });
    const unresolved = buildMention(
      { sentiment: 'negative' },
      { title: 'Harvey faces lawsuit', publisherUrl: null, googleUrl: 'https://news.google.com/rss/articles/x' },
    );
    renderPanel({
      getCompany: () => Promise.resolve(buildCompanyDetail()),
      listCompanyCandidates: () => Promise.resolve(buildPage([resolved, unresolved])),
    });

    const publisherLink = await screen.findByRole('link', { name: 'Harvey raises Series F' });
    expect(publisherLink).toHaveAttribute('href', 'https://outlet.example/f');
    expect(publisherLink).toHaveAttribute('target', '_blank');
    expect(publisherLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Harvey faces lawsuit' })).toHaveAttribute(
      'href',
      'https://news.google.com/rss/articles/x',
    );
    const mentions = screen.getByRole('region', { name: 'Mentions' });
    expect(within(mentions).getByText('Negative')).toBeInTheDocument();
    expect(screen.getAllByText('Reports a new funding round.')).toHaveLength(2);
  });

  it('shows rejected Candidates with reason and method only when toggled', async () => {
    const listCompanyCandidates = vi.fn((_id: number, query: CandidatesQuery) =>
      Promise.resolve(
        query.include === 'all'
          ? buildPage([buildMention({}, { title: 'Harvey AI expands' }), buildRejected()])
          : buildPage([buildMention({}, { title: 'Harvey AI expands' })]),
      ),
    );
    renderPanel({ getCompany: () => Promise.resolve(buildCompanyDetail()), listCompanyCandidates });

    await screen.findByRole('link', { name: 'Harvey AI expands' });
    expect(listCompanyCandidates).toHaveBeenLastCalledWith(6, expect.objectContaining({ include: 'mentions' }));
    expect(screen.queryByText(/Rejected/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show rejected Candidates' }));

    expect(await screen.findByText('Rejected · Name absent')).toBeInTheDocument();
    expect(screen.getByText('The company name does not appear in the title or snippet.')).toBeInTheDocument();
    expect(listCompanyCandidates).toHaveBeenLastCalledWith(
      6,
      expect.objectContaining({ include: 'all', page: 1, window: '2026-Q3' }),
    );
  });

  it('pages through Mentions and restarts at page 1 when the toggle changes', async () => {
    const listCompanyCandidates = vi.fn((_id: number, query: CandidatesQuery) => {
      const page = query.page ?? 1;
      return Promise.resolve(
        buildPage([buildMention({}, { title: `Page ${page} headline` })], { total: 45, page, pageSize: 20 }),
      );
    });
    renderPanel({ getCompany: () => Promise.resolve(buildCompanyDetail()), listCompanyCandidates });

    expect(await screen.findByText('Page 1 of 3 · 45 total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('link', { name: 'Page 2 headline' })).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3 · 45 total')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 3 of 3 · 45 total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show rejected Candidates' }));
    expect(await screen.findByText('Page 1 of 3 · 45 total')).toBeInTheDocument();
    expect(listCompanyCandidates).toHaveBeenLastCalledWith(6, expect.objectContaining({ include: 'all', page: 1 }));
  });

  it('shows an error when Mentions cannot be loaded', async () => {
    renderPanel({
      getCompany: () => Promise.resolve(buildCompanyDetail()),
      listCompanyCandidates: () => Promise.reject(new ApiError(500, 'Internal server error', null)),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load Mentions: Internal server error');
  });
});
