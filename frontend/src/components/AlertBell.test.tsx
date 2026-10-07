import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../api.ts';
import { ApiError, NetworkError } from '../apiErrors.ts';
import { ALERTS_POLL_MS } from '../queries.ts';
import { digestDetail, digestSummary, laterDigestSummary, renderWithApi } from '../test/alertsOperationsFixtures.tsx';
import type { AlertDigestSummary } from '../types.ts';
import { AlertBell } from './AlertBell.tsx';

/**
 * Advances fake time, then a few short ticks so the fetches it started resolve
 * and render: TanStack Query delivers results to observers on timers.
 */
async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let tick = 0; tick < 5; tick += 1) await vi.advanceTimersByTimeAsync(10);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

function api(overrides: Partial<ApiClient> = {}): Partial<ApiClient> {
  return {
    listAlerts: vi.fn(() => Promise.resolve([digestSummary])),
    getAlert: vi.fn(() => Promise.resolve(digestDetail)),
    ...overrides,
  };
}

describe('AlertBell', () => {
  it('shows the unacknowledged count and asks only for unacknowledged digests', async () => {
    const fake = api();
    renderWithApi(<AlertBell />, fake);
    expect(await screen.findByRole('button', { name: 'Alerts, 1 unacknowledged digest' })).toBeInTheDocument();
    expect(fake.listAlerts).toHaveBeenCalledWith({ acknowledged: false });
  });

  it('polls the unacknowledged digests', async () => {
    vi.useFakeTimers();
    const fake = api();
    renderWithApi(<AlertBell />, fake);
    await flush();
    expect(fake.listAlerts).toHaveBeenCalledTimes(1);
    await flush(ALERTS_POLL_MS);
    expect(fake.listAlerts).toHaveBeenCalledTimes(2);
  });

  it('opens a panel with New Mentions grouped by company, negatives first, linking to the article', async () => {
    renderWithApi(<AlertBell />, api());
    fireEvent.click(await screen.findByRole('button', { name: /Alerts, 1 unacknowledged/ }));

    const panel = screen.getByRole('dialog', { name: 'Alert Digests' });
    expect(within(panel).getByText('3 New Mentions across 2 companies, 1 negative')).toBeInTheDocument();
    const groups = await within(panel).findAllByRole('region');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['OncoHost', 'ZutaCore']);

    const oncoHostItems = within(groups[0] as HTMLElement).getAllByRole('listitem');
    expect(oncoHostItems[0]).toHaveTextContent('negative');
    expect(oncoHostItems[0]).toHaveTextContent('OncoHost trims workforce');
    const link = within(oncoHostItems[0] as HTMLElement).getByRole('link', { name: 'OncoHost trims workforce' });
    expect(link).toHaveAttribute('href', 'https://www.calcalistech.com/ctechnews/article/fixture-203');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('acknowledges a digest and refreshes the list', async () => {
    let unacknowledged: readonly AlertDigestSummary[] = [digestSummary];
    const listAlerts = vi.fn(() => Promise.resolve(unacknowledged));
    const acknowledgeAlert = vi.fn((id: number) => {
      unacknowledged = [];
      return Promise.resolve({ ...digestSummary, id, acknowledgedAt: '2026-10-08T08:00:00.000Z' });
    });
    renderWithApi(<AlertBell />, api({ listAlerts, acknowledgeAlert }));

    fireEvent.click(await screen.findByRole('button', { name: /Alerts, 1 unacknowledged/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));

    await vi.waitFor(() => {
      expect(acknowledgeAlert).toHaveBeenCalledWith(11);
    });
    expect(await screen.findByText('No unacknowledged Alert Digests.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alerts, 0 unacknowledged digests' })).toBeInTheDocument();
    expect(listAlerts).toHaveBeenCalledTimes(2);
  });

  it('keeps the digest and shows the error when acknowledging fails', async () => {
    renderWithApi(
      <AlertBell />,
      api({ acknowledgeAlert: () => Promise.reject(new ApiError(404, 'Alert Digest 11 not found', null)) }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /Alerts, 1 unacknowledged/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not acknowledge: Alert Digest 11 not found');
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeEnabled();
  });

  it('shows a load error on the bell and in the panel', async () => {
    renderWithApi(<AlertBell />, api({ listAlerts: () => Promise.reject(new NetworkError('offline')) }));
    fireEvent.click(await screen.findByRole('button', { name: 'Alerts (could not load)' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load Alert Digests: Cannot reach the server');
  });

  it('shows an error for a digest whose detail cannot be loaded', async () => {
    renderWithApi(<AlertBell />, api({ getAlert: () => Promise.reject(new ApiError(500, 'Internal server error', null)) }));
    fireEvent.click(await screen.findByRole('button', { name: /Alerts, 1 unacknowledged/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this digest: Internal server error');
  });

  it('notifies about a digest that arrives while the page is open, but not about existing ones', async () => {
    vi.useFakeTimers();
    let unacknowledged: readonly AlertDigestSummary[] = [digestSummary];
    renderWithApi(<AlertBell />, api({ listAlerts: () => Promise.resolve(unacknowledged) }));
    await flush();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    unacknowledged = [laterDigestSummary, digestSummary];
    await flush(ALERTS_POLL_MS);

    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('New Alert Digest');
    expect(toast).toHaveTextContent('1 New Mention across 1 company, 0 negative');
    expect(screen.getByRole('button', { name: 'Alerts, 2 unacknowledged digests' })).toBeInTheDocument();

    fireEvent.click(within(toast).getByRole('button', { name: 'View alerts' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Alert Digests' })).toBeInTheDocument();

    // The same digest on the next poll does not notify again.
    await flush(ALERTS_POLL_MS);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses the notification', async () => {
    vi.useFakeTimers();
    let unacknowledged: readonly AlertDigestSummary[] = [];
    const listAlerts = vi.fn(() => Promise.resolve(unacknowledged));
    renderWithApi(<AlertBell />, api({ listAlerts }));
    await flush();
    unacknowledged = [laterDigestSummary];
    await flush(ALERTS_POLL_MS);
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
