import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../api.ts';
import { ApiClientContext } from '../apiClientContext.ts';
import {
  addedByHand,
  adminCompanies,
  harveyNeedsReview,
  lambdaActive,
  lambdaReprocessRun,
  runConflict,
  validationError,
} from '../test/companiesPage.fixtures.ts';
import { createFakeApiClient } from '../test/fixtures.ts';
import type { AdminCompaniesQuery, AdminCompany } from '../types.ts';
import { CompaniesPage } from './CompaniesPage.tsx';

/** Answers the list endpoint from the fixtures, honouring the status filter and the search text. */
function listFromFixtures(query: AdminCompaniesQuery): Promise<readonly AdminCompany[]> {
  const q = query.q?.toLocaleLowerCase();
  return Promise.resolve(
    adminCompanies.filter(
      (company) =>
        (query.status === undefined || company.status === query.status) &&
        (q === undefined || company.displayName.toLocaleLowerCase().includes(q)),
    ),
  );
}

/** Renders the page against an in-memory ApiClient; returns the list endpoint's mock. */
function renderPage(overrides: Partial<ApiClient> = {}): ReturnType<typeof vi.fn<ApiClient['listAdminCompanies']>> {
  const listAdminCompanies = vi.fn<ApiClient['listAdminCompanies']>(listFromFixtures);
  const api = createFakeApiClient({ listAdminCompanies, ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <ApiClientContext.Provider value={api}>
      <QueryClientProvider client={queryClient}>
        <CompaniesPage />
      </QueryClientProvider>
    </ApiClientContext.Provider>,
  );
  return listAdminCompanies;
}

async function openCompany(displayName: string): Promise<HTMLElement> {
  const list = await screen.findByRole('list', { name: 'Tracked companies' });
  fireEvent.click(within(list).getByRole('button', { name: new RegExp(`^${displayName}`) }));
  return screen.findByRole('region', { name: displayName });
}

describe('CompaniesPage list', () => {
  it('shows every company, the Needs Review count and the review reason', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Tracked companies' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText(harveyNeedsReview.reviewReason ?? '')).toBeInTheDocument();
    expect(await screen.findByText('1 company needs review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs Review (1)' })).toBeInTheDocument();
  });

  it('filters by status through the API', async () => {
    const listAdminCompanies = renderPage();
    await screen.findByRole('list', { name: 'Tracked companies' });
    fireEvent.click(screen.getByRole('button', { name: 'Deactivated' }));

    await waitFor(() => {
      expect(listAdminCompanies).toHaveBeenCalledWith({ status: 'deactivated' });
    });
    const list = await screen.findByRole('list', { name: 'Tracked companies' });
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    });
    expect(within(list).getByText('Ludeo')).toBeInTheDocument();
  });

  it('searches through the API on submit', async () => {
    const listAdminCompanies = renderPage();
    await screen.findByRole('list', { name: 'Tracked companies' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search companies' }), { target: { value: ' lamb ' } });
    fireEvent.submit(screen.getByRole('search'));

    await waitFor(() => {
      expect(listAdminCompanies).toHaveBeenCalledWith({ q: 'lamb' });
    });
  });

  it('reports a failed load', async () => {
    renderPage({ listAdminCompanies: () => Promise.reject(new Error('Request failed with status 503')) });
    expect(await screen.findByText(/Could not load companies: Request failed with status 503/)).toBeInTheDocument();
  });
});

describe('editing a company', () => {
  it('shows the Source Name read-only and never sends it', async () => {
    const updateCompany = vi.fn<ApiClient['updateCompany']>((_id, changes) =>
      Promise.resolve({ ...lambdaActive, ...changes, updatedAt: '2026-10-07T08:00:00.000Z' }),
    );
    renderPage({ updateCompany });
    const panel = await openCompany('Lambda');

    expect(within(panel).getByText('Lambda (lambda.ai)')).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox', { name: /source name/i })).toBeNull();
    for (const textbox of within(panel).getAllByRole('textbox')) {
      expect(textbox).not.toHaveValue('Lambda (lambda.ai)');
    }

    const save = within(panel).getByRole('button', { name: 'Save profile' });
    fireEvent.click(save);
    expect(within(panel).getByRole('alert')).toHaveTextContent('There are no changes to save.');
    expect(updateCompany).not.toHaveBeenCalled();
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Description' }), {
      target: { value: 'GPU cloud for AI training' },
    });
    fireEvent.click(save);

    await waitFor(() => {
      expect(updateCompany).toHaveBeenCalledWith(lambdaActive.id, { description: 'GPU cloud for AI training' });
    });
    expect(await within(panel).findByText(/Profile saved/)).toBeInTheDocument();
    // Re-process is offered once the profile is saved.
    expect(within(panel).getByRole('button', { name: 'Re-process…' })).toBeEnabled();
  });

  it('edits aliases and search terms as chips', async () => {
    const updateCompany = vi.fn<ApiClient['updateCompany']>(() => Promise.resolve(lambdaActive));
    renderPage({ updateCompany });
    const panel = await openCompany('Lambda');

    const aliases = within(panel).getByRole('textbox', { name: 'Aliases' });
    fireEvent.change(aliases, { target: { value: 'Lambda Labs' } });
    fireEvent.keyDown(aliases, { key: 'Enter' });
    expect(within(panel).getByRole('list', { name: 'Aliases' })).toHaveTextContent('Lambda Labs');

    fireEvent.click(within(panel).getByRole('button', { name: 'Remove search term "Lambda" GPU cloud' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(updateCompany).toHaveBeenCalledWith(lambdaActive.id, { aliases: ['Lambda Labs'], searchTerms: [] });
    });
  });

  it('renders server validation errors under their fields', async () => {
    renderPage({
      updateCompany: () =>
        Promise.reject(validationError(['domain must be a valid domain name', 'property website should not exist'])),
    });
    const panel = await openCompany('Lambda');
    const domain = within(panel).getByRole('textbox', { name: 'Domain' });
    fireEvent.change(domain, { target: { value: 'not a domain' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(domain).toHaveAccessibleDescription(expect.stringContaining('domain must be a valid domain name'));
    });
    expect(domain).toHaveAttribute('aria-invalid', 'true');
    expect(within(panel).getByRole('alert')).toHaveTextContent('property website should not exist');
    expect(within(panel).getByRole('textbox', { name: 'Description' })).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('lifecycle actions', () => {
  it('marks a Needs Review company reviewed, keeps it open and offers Re-process', async () => {
    const markCompanyReviewed = vi.fn<ApiClient['markCompanyReviewed']>(() =>
      Promise.resolve({ ...harveyNeedsReview, status: 'active', reviewReason: null, updatedAt: '2026-10-07T08:00:00.000Z' }),
    );
    renderPage({ markCompanyReviewed });
    fireEvent.click(await screen.findByRole('button', { name: 'Needs Review (1)' }));
    const panel = await openCompany('Harvey');

    expect(within(panel).getByText(/Needs review:/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Re-process…' })).toBeDisabled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Mark reviewed' }));

    await waitFor(() => {
      expect(markCompanyReviewed).toHaveBeenCalledWith(harveyNeedsReview.id);
    });
    expect(await within(panel).findByText(/Marked reviewed/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Re-process…' })).toBeEnabled();
    expect(within(panel).getByRole('button', { name: 'Send to Needs Review' })).toBeInTheDocument();
  });

  it('sends an active company back to Needs Review', async () => {
    const sendCompanyToReview = vi.fn<ApiClient['sendCompanyToReview']>(() =>
      Promise.resolve({ ...lambdaActive, status: 'needs_review', updatedAt: '2026-10-07T08:00:00.000Z' }),
    );
    renderPage({ sendCompanyToReview });
    const panel = await openCompany('Lambda');
    fireEvent.click(within(panel).getByRole('button', { name: 'Send to Needs Review' }));

    await waitFor(() => {
      expect(sendCompanyToReview).toHaveBeenCalledWith(lambdaActive.id);
    });
    expect(await within(panel).findByText(/Sent to Needs Review/)).toBeInTheDocument();
  });

  it('deactivates only after an in-page confirmation', async () => {
    const deactivateCompany = vi.fn<ApiClient['deactivateCompany']>(() =>
      Promise.resolve({ ...lambdaActive, status: 'deactivated', updatedAt: '2026-10-07T08:00:00.000Z' }),
    );
    const confirm = vi.spyOn(window, 'confirm');
    renderPage({ deactivateCompany });
    const panel = await openCompany('Lambda');

    fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate…' }));
    const confirmation = within(panel).getByRole('group', { name: 'Confirm deactivation' });
    expect(confirmation).toHaveTextContent(/Candidates and Mentions are kept/);
    expect(deactivateCompany).not.toHaveBeenCalled();

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).queryByRole('group', { name: 'Confirm deactivation' })).toBeNull();

    fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate…' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(deactivateCompany).toHaveBeenCalledWith(lambdaActive.id);
    });
    expect(await within(panel).findByText(/^Deactivated\. Its history is kept/)).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Deactivate…' })).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('guards between the form and the actions', () => {
  it('blocks status actions while the profile has unsaved edits', async () => {
    const markCompanyReviewed = vi.fn<ApiClient['markCompanyReviewed']>();
    renderPage({ markCompanyReviewed });
    const panel = await openCompany('Harvey');

    fireEvent.change(within(panel).getByRole('textbox', { name: 'Description' }), {
      target: { value: 'AI for legal work' },
    });
    expect(within(panel).getByRole('button', { name: 'Mark reviewed' })).toBeDisabled();
    expect(within(panel).getByText(/Save or discard your profile changes/)).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Discard changes' }));
    expect(within(panel).getByRole('textbox', { name: 'Description' })).toHaveValue('');
    expect(within(panel).getByRole('button', { name: 'Mark reviewed' })).toBeEnabled();
  });

  it('closes an open Re-process confirmation when the company stops being active', async () => {
    const sendCompanyToReview = vi.fn<ApiClient['sendCompanyToReview']>(() =>
      Promise.resolve({ ...lambdaActive, status: 'needs_review', updatedAt: '2026-10-07T08:00:00.000Z' }),
    );
    renderPage({ sendCompanyToReview });
    const panel = await openCompany('Lambda');
    fireEvent.click(within(panel).getByRole('button', { name: 'Re-process…' }));
    expect(within(panel).getByRole('button', { name: 'Replace history and re-process' })).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Send to Needs Review' }));

    expect(await within(panel).findByText(/Sent to Needs Review/)).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Replace history and re-process' })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Re-process…' })).toBeDisabled();
    // The status change is not mistaken for someone else's profile edit.
    expect(within(panel).queryByText(/changed elsewhere/)).toBeNull();
  });
});

describe('Re-process', () => {
  it('explains that history is replaced and queues a Backfill after confirmation', async () => {
    const reprocessCompany = vi.fn<ApiClient['reprocessCompany']>(() => Promise.resolve(lambdaReprocessRun));
    renderPage({ reprocessCompany });
    const panel = await openCompany('Lambda');
    const section = within(panel).getByRole('region', { name: 'Re-process' });

    expect(section).toHaveTextContent(/history is replaced, not kept/);
    fireEvent.click(within(section).getByRole('button', { name: 'Re-process…' }));
    expect(reprocessCompany).not.toHaveBeenCalled();
    fireEvent.click(within(section).getByRole('button', { name: 'Replace history and re-process' }));

    expect(await within(section).findByRole('status')).toHaveTextContent('Backfill #32 queued for Lambda');
    expect(reprocessCompany).toHaveBeenCalledWith(lambdaActive.id);
  });

  it('explains a 409 while another Run is active', async () => {
    renderPage({ reprocessCompany: () => Promise.reject(runConflict()) });
    const panel = await openCompany('Lambda');
    const section = within(panel).getByRole('region', { name: 'Re-process' });

    fireEvent.click(within(section).getByRole('button', { name: 'Re-process…' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Replace history and re-process' }));

    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'Another Run is active (Daily Check #31 is running). Re-process once it has finished.',
    );
    expect(within(section).getByRole('button', { name: 'Re-process…' })).toBeEnabled();
  });
});

describe('adding a company', () => {
  it('creates a company without a Source Name and opens it', async () => {
    const createCompany = vi.fn<ApiClient['createCompany']>((request) =>
      Promise.resolve({ ...addedByHand(request.displayName, 200), searchTerms: request.searchTerms ?? [] }),
    );
    renderPage({ createCompany });
    await screen.findByRole('list', { name: 'Tracked companies' });
    fireEvent.click(screen.getByRole('button', { name: 'Add company' }));

    const form = screen.getByRole('region', { name: 'Add company' });
    expect(within(form).queryByText(/^Source Name$/)).toBeNull();
    const submit = within(form).getByRole('button', { name: 'Add company' });
    expect(submit).toBeDisabled();

    fireEvent.change(within(form).getByRole('textbox', { name: 'Display name' }), { target: { value: 'Glean' } });
    const searchTerms = within(form).getByRole('textbox', { name: 'Search terms' });
    fireEvent.change(searchTerms, { target: { value: 'Glean AI' } });
    fireEvent.keyDown(searchTerms, { key: 'Enter' });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(createCompany).toHaveBeenCalledWith({
        displayName: 'Glean',
        description: null,
        domain: null,
        aliases: [],
        searchTerms: ['Glean AI'],
      });
    });
    const panel = await screen.findByRole('region', { name: 'Glean' });
    expect(within(panel).getByText('None — added by hand')).toBeInTheDocument();
    expect(within(panel).getByText(/Company added/)).toBeInTheDocument();
  });

  it('shows validation errors on the add form', async () => {
    renderPage({ createCompany: () => Promise.reject(validationError(['displayName must be shorter than or equal to 200 characters'])) });
    await screen.findByRole('list', { name: 'Tracked companies' });
    fireEvent.click(screen.getByRole('button', { name: 'Add company' }));
    const form = screen.getByRole('region', { name: 'Add company' });
    const displayName = within(form).getByRole('textbox', { name: 'Display name' });

    fireEvent.change(displayName, { target: { value: 'Island'.repeat(40) } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add company' }));

    await waitFor(() => {
      expect(displayName).toHaveAccessibleDescription('displayName must be shorter than or equal to 200 characters');
    });
    expect(screen.getByRole('region', { name: 'Add company' })).toBeInTheDocument();
  });
});
