import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../api.ts';
import { ApiClientContext } from '../apiClientContext.ts';
import { ApiError } from '../apiErrors.ts';
import { SEARCH_DEBOUNCE_MS } from '../components/CompanySearchBox.tsx';
import { createFakeApiClient } from '../test/fixtures.ts';
import { buildCompanyRow, buildCoverageSummary, overviewRows } from '../test/overviewFixtures.ts';
import type { CompaniesQuery, CompanyOverviewRow, CoverageSummary } from '../types.ts';
import { OverviewPage } from './OverviewPage.tsx';

interface Setup {
  router: ReturnType<typeof createMemoryRouter>;
  listCompanies: ReturnType<typeof vi.fn<ApiClient['listCompanies']>>;
  getSummary: ReturnType<typeof vi.fn<ApiClient['getSummary']>>;
}

function renderOverview(
  path = '/',
  api: {
    rows?: readonly CompanyOverviewRow[];
    summary?: CoverageSummary;
    listCompanies?: ApiClient['listCompanies'];
    getSummary?: ApiClient['getSummary'];
  } = {},
): Setup {
  const listCompanies = vi.fn<ApiClient['listCompanies']>(
    api.listCompanies ?? (() => Promise.resolve(api.rows ?? overviewRows)),
  );
  const getSummary = vi.fn<ApiClient['getSummary']>(
    api.getSummary ?? (() => Promise.resolve(api.summary ?? buildCoverageSummary())),
  );
  const router = createMemoryRouter([{ path: '/', element: <OverviewPage /> }], { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ApiClientContext.Provider value={createFakeApiClient({ listCompanies, getSummary })}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiClientContext.Provider>,
  );
  return { router, listCompanies, getSummary };
}

function lastCompaniesQuery(listCompanies: Setup['listCompanies']): CompaniesQuery | undefined {
  return listCompanies.mock.lastCall?.[0];
}

async function bodyRowNames(): Promise<string[]> {
  const table = await screen.findByRole('table');
  return within(table)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent);
}

function search(router: Setup['router']): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(router.state.location.search));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('OverviewPage company table', () => {
  it('asks for the default sort (negatives, then recency) and keeps the API order', async () => {
    const { listCompanies } = renderOverview();
    expect(await bodyRowNames()).toEqual(['Morphisec', 'ZutaCore', 'OncoHost', 'Maolac']);
    expect(lastCompaniesQuery(listCompanies)).toEqual({ window: 'rolling90', sort: 'negatives' });
    expect(screen.getByRole('columnheader', { name: /Sentiment/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('sorts by a column when its header is clicked and keeps the sort in the URL', async () => {
    const { router, listCompanies } = renderOverview();
    await bodyRowNames();
    fireEvent.click(screen.getByRole('button', { name: 'Mentions' }));
    expect(search(router)).toEqual({ sort: 'mentions' });
    // The previous rows stay on screen while the new order loads.
    expect(screen.queryByText('Loading companies…')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    await waitFor(() => {
      expect(lastCompaniesQuery(listCompanies)).toEqual({ window: 'rolling90', sort: 'mentions' });
    });
    expect(screen.getByRole('columnheader', { name: /Mentions/ })).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(screen.getByRole('button', { name: /Sentiment/ }));
    expect(search(router)).toEqual({});
  });

  it('labels a capped Mention count "100+"', async () => {
    renderOverview();
    const row = (await screen.findByRole('rowheader', { name: 'Morphisec' })).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('100+')).toBeInTheDocument();
  });

  it('labels a company with no coverage with the date nothing has been found since', async () => {
    renderOverview();
    const row = (await screen.findByRole('rowheader', { name: 'Maolac' })).closest('tr') as HTMLElement;
    expect(within(row).getByText('No coverage')).toBeInTheDocument();
    expect(await within(row).findByText('No coverage found since Jul 9, 2026')).toBeInTheDocument();
  });

  it('says how long ago a company was last mentioned', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T12:00:00.000Z'));
    renderOverview();
    const row = (await screen.findByRole('rowheader', { name: 'ZutaCore' })).closest('tr') as HTMLElement;
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(row).getByText('3 days ago')).toBeInTheDocument();
    expect(within(row).getByRole('img', { name: '8 positive, 1 negative, 3 neutral' })).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'ZutaCore placeholder headline' })).toHaveAttribute(
      'href',
      'https://news.example.com/zutacore',
    );
  });

  it('does not render a headline with a non-http URL as a link', async () => {
    renderOverview('/', {
      rows: [
        buildCompanyRow({
          latestHeadline: {
            title: 'Unsafe headline',
            outletName: 'Placeholder Outlet',
            url: 'javascript:alert(1)',
            publishedAt: '2026-10-04T12:00:00.000Z',
          },
        }),
      ],
    });
    expect(await screen.findByText('Unsafe headline')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unsafe headline' })).not.toBeInTheDocument();
  });

  it('opens the company detail when a row is clicked', async () => {
    const { router } = renderOverview('/?window=2026-Q3');
    const row = (await screen.findByRole('rowheader', { name: 'OncoHost' })).closest('tr') as HTMLElement;
    fireEvent.click(row);
    expect(search(router)).toEqual({ window: '2026-Q3', company: '2' });
  });

  it('opens the company detail from the keyboard-reachable name button', async () => {
    const { router } = renderOverview();
    fireEvent.click(await screen.findByRole('button', { name: 'ZutaCore' }));
    expect(search(router)).toEqual({ company: '1' });
  });
});

describe('OverviewPage filters', () => {
  it('reads filters, sort and window from the URL', async () => {
    const { listCompanies, getSummary } = renderOverview(
      '/?window=2026-Q3&status=quiet&hasNegatives=true&q=onco&sort=name',
    );
    await bodyRowNames();
    expect(lastCompaniesQuery(listCompanies)).toEqual({
      window: '2026-Q3',
      status: 'quiet',
      hasNegatives: true,
      q: 'onco',
      sort: 'name',
    });
    expect(getSummary).toHaveBeenLastCalledWith({ window: '2026-Q3' });
    expect(screen.getByLabelText('Mention status')).toHaveValue('quiet');
    expect(screen.getByLabelText('Has negative Mentions')).toBeChecked();
    expect(screen.getByLabelText('Search')).toHaveValue('onco');
  });

  it('filters by Mention Status', async () => {
    const { router, listCompanies } = renderOverview();
    await bodyRowNames();
    fireEvent.change(screen.getByLabelText('Mention status'), { target: { value: 'recent' } });
    expect(search(router)).toEqual({ status: 'recent' });
    await waitFor(() => {
      expect(lastCompaniesQuery(listCompanies)).toEqual({ window: 'rolling90', status: 'recent', sort: 'negatives' });
    });
    fireEvent.change(screen.getByLabelText('Mention status'), { target: { value: '' } });
    expect(search(router)).toEqual({});
  });

  it('filters to companies with negative Mentions from the checkbox', async () => {
    const { router, listCompanies } = renderOverview();
    await bodyRowNames();
    fireEvent.click(screen.getByLabelText('Has negative Mentions'));
    expect(search(router)).toEqual({ hasNegatives: 'true' });
    await waitFor(() => {
      expect(lastCompaniesQuery(listCompanies)).toEqual({ window: 'rolling90', hasNegatives: true, sort: 'negatives' });
    });
  });

  it('searches by name once typing pauses', async () => {
    const { router, listCompanies } = renderOverview();
    await bodyRowNames();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: ' Morph ' } });
    expect(search(router)).toEqual({});
    await waitFor(() => {
      expect(search(router)).toEqual({ q: 'Morph' });
    });
    await waitFor(() => {
      expect(lastCompaniesQuery(listCompanies)).toEqual({ window: 'rolling90', q: 'Morph', sort: 'negatives' });
    });
  });

  it('shows a search changed from outside (Back) without re-applying the old one', async () => {
    const { router } = renderOverview();
    await bodyRowNames();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Morph' } });
    await waitFor(() => {
      expect(search(router)).toEqual({ q: 'Morph' });
    });
    await act(() => router.navigate(-1));
    expect(search(router)).toEqual({});
    expect(screen.getByLabelText('Search')).toHaveValue('');
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 100));
    expect(search(router)).toEqual({});
  });

  it('distinguishes "no match" from "no companies"', async () => {
    renderOverview('/?q=nothing', { rows: [] });
    expect(await screen.findByText('No companies match these filters.')).toBeInTheDocument();
  });

  it('says so when there are no Tracked Companies at all', async () => {
    renderOverview('/', { rows: [] });
    expect(await screen.findByText('No Tracked Companies yet.')).toBeInTheDocument();
  });
});

describe('OverviewPage summary strip', () => {
  it('shows the totals for the window', async () => {
    renderOverview();
    const strip = await screen.findByRole('region', { name: 'Summary' });
    expect(within(strip).getByRole('button', { name: /Active\s*2/ })).toBeInTheDocument();
    expect(within(strip).getByRole('button', { name: /No coverage\s*1/ })).toBeInTheDocument();
    expect(within(strip).getByText('128')).toBeInTheDocument();
    expect(within(strip).getByText('70 positive · 8 negative · 50 neutral')).toBeInTheDocument();
    expect(within(strip).getByText('across 2 companies')).toBeInTheDocument();
  });

  it('filters the table to companies with negatives from the negative Mentions tile', async () => {
    const { router, listCompanies } = renderOverview();
    const tile = await screen.findByRole('button', { name: /Negative Mentions in window/ });
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tile);
    expect(search(router)).toEqual({ hasNegatives: 'true' });
    expect(tile).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(lastCompaniesQuery(listCompanies)).toEqual({ window: 'rolling90', hasNegatives: true, sort: 'negatives' });
    });
    fireEvent.click(tile);
    expect(search(router)).toEqual({});
  });

  it('filters the table by Mention Status from a status tile', async () => {
    const { router } = renderOverview();
    fireEvent.click(await screen.findByRole('button', { name: /Quiet\s*1/ }));
    expect(search(router)).toEqual({ status: 'quiet' });
    expect(screen.getByLabelText('Mention status')).toHaveValue('quiet');
  });
});

describe('OverviewPage error states', () => {
  it('shows the companies error and retries on request', async () => {
    let attempts = 0;
    const { listCompanies } = renderOverview('/', {
      listCompanies: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new ApiError(500, 'Database unavailable', null))
          : Promise.resolve(overviewRows);
      },
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the companies: Database unavailable');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await bodyRowNames()).toHaveLength(4);
    expect(listCompanies).toHaveBeenCalledTimes(2);
  });

  it('shows the summary error without hiding the table', async () => {
    renderOverview('/', { getSummary: () => Promise.reject(new ApiError(503, 'Service Unavailable', null)) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the summary: Service Unavailable');
    expect(await bodyRowNames()).toHaveLength(4);
    const row = screen.getByRole('rowheader', { name: 'Maolac' }).closest('tr') as HTMLElement;
    expect(within(row).getByText('No coverage found')).toBeInTheDocument();
  });

  it('shows loading states while the requests are in flight', () => {
    renderOverview('/', {
      listCompanies: () => new Promise(() => undefined),
      getSummary: () => new Promise(() => undefined),
    });
    expect(screen.getByText('Loading summary…')).toBeInTheDocument();
    expect(screen.getByText('Loading companies…')).toBeInTheDocument();
  });
});
