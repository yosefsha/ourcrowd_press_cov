import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../api.ts';
import { ApiError, NetworkError, RunConflictError } from '../apiErrors.ts';
import { ACTIVE_RUN_POLL_MS } from '../queries.ts';
import {
  activeCompanies,
  completedBackfill,
  dailyCheckWithErrors,
  failedDailyCheck,
  healthyCollector,
  renderWithApi,
  runningBackfill,
} from '../test/alertsOperationsFixtures.tsx';
import { buildRun } from '../test/fixtures.ts';
import type { Run } from '../types.ts';
import { OperationsPage } from './OperationsPage.tsx';

function idleApi(overrides: Partial<ApiClient> = {}): Partial<ApiClient> {
  return {
    getActiveRun: vi.fn(() => Promise.resolve(null)),
    listRuns: vi.fn(() => Promise.resolve([dailyCheckWithErrors, completedBackfill])),
    getCollectorHealth: vi.fn(() => Promise.resolve(healthyCollector)),
    listAdminCompanies: vi.fn(() => Promise.resolve(activeCompanies)),
    ...overrides,
  };
}

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

describe('OperationsPage polling', () => {
  it('polls the active Run and history while a Run is running, and stops once it finishes', async () => {
    vi.useFakeTimers();
    let active: Run | null = runningBackfill;
    let history: readonly Run[] = [runningBackfill];
    const getActiveRun = vi.fn(() => Promise.resolve(active));
    const listRuns = vi.fn(() => Promise.resolve(history));
    renderWithApi(<OperationsPage />, idleApi({ getActiveRun, listRuns }));
    await flush();

    expect(getActiveRun).toHaveBeenCalledTimes(1);
    expect(screen.getByText('12 / 40 companies')).toBeInTheDocument();

    await flush(ACTIVE_RUN_POLL_MS);
    expect(getActiveRun).toHaveBeenCalledTimes(2);
    expect(listRuns).toHaveBeenCalledTimes(2);

    active = null;
    history = [completedBackfill];
    await flush(ACTIVE_RUN_POLL_MS);
    expect(getActiveRun).toHaveBeenCalledTimes(3);
    expect(screen.getByText('No Run is queued or running.')).toBeInTheDocument();

    await flush(ACTIVE_RUN_POLL_MS * 4);
    expect(getActiveRun).toHaveBeenCalledTimes(3);
    expect(listRuns).toHaveBeenCalledTimes(3);
  });

  it('does not poll Runs while idle', async () => {
    vi.useFakeTimers();
    const api = idleApi();
    renderWithApi(<OperationsPage />, api);
    await flush();
    await flush(ACTIVE_RUN_POLL_MS * 3);
    expect(api.getActiveRun).toHaveBeenCalledTimes(1);
    expect(api.listRuns).toHaveBeenCalledTimes(1);
  });

  it('starts polling when the collector reports a Run the page has not seen (e.g. the daily cron)', async () => {
    vi.useFakeTimers();
    const getActiveRun = vi.fn(() => Promise.resolve(null));
    renderWithApi(
      <OperationsPage />,
      idleApi({ getActiveRun, getCollectorHealth: () => Promise.resolve({ ...healthyCollector, state: 'running' }) }),
    );
    await flush();
    await flush(ACTIVE_RUN_POLL_MS);
    expect(getActiveRun).toHaveBeenCalledTimes(2);
  });
});

describe('OperationsPage controls', () => {
  it('disables both actions while a Run is queued or running', async () => {
    renderWithApi(<OperationsPage />, idleApi({ getActiveRun: () => Promise.resolve(buildRun({ status: 'queued' })) }));
    expect(await screen.findByText(/Waiting for the collector/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Backfill' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Run Daily Check now' })).toBeDisabled();
  });

  it('keeps the actions disabled until the active Run is known', () => {
    renderWithApi(<OperationsPage />, idleApi({ getActiveRun: () => new Promise<never>(() => undefined) }));
    expect(screen.getByRole('button', { name: 'Run Daily Check now' })).toBeDisabled();
  });

  it('enables the actions when the active Run cannot be loaded (the API still guards with 409)', async () => {
    renderWithApi(
      <OperationsPage />,
      idleApi({ getActiveRun: () => Promise.reject(new NetworkError('GET /api/runs/active failed')) }),
    );
    expect(await screen.findByText(/Could not load the active Run: Cannot reach the server/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Daily Check now' })).toBeEnabled();
  });

  it('enqueues a Daily Check and disables the actions while the request is in flight', async () => {
    let resolveEnqueue: (run: Run) => void = () => undefined;
    const enqueueRun = vi.fn(
      () =>
        new Promise<Run>((resolve) => {
          resolveEnqueue = resolve;
        }),
    );
    const queued = buildRun({ id: 8, status: 'queued', progress: null, startedAt: null });
    const getActiveRun = vi.fn<() => Promise<Run | null>>(() => Promise.resolve(null));
    renderWithApi(<OperationsPage />, idleApi({ enqueueRun, getActiveRun }));

    const button = await screen.findByRole('button', { name: 'Run Daily Check now' });
    await vi.waitFor(() => {
      expect(button).toBeEnabled();
    });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(enqueueRun).toHaveBeenCalledWith({ type: 'daily_check' });
    });
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start Backfill' })).toBeDisabled();

    getActiveRun.mockResolvedValue(queued);
    act(() => {
      resolveEnqueue(queued);
    });
    expect(await screen.findByText('Run #8 queued. The collector picks it up within a few seconds.')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('shows the 409 with the Run already in progress', async () => {
    const conflict = new RunConflictError('A Run is already queued or running', {}, runningBackfill);
    renderWithApi(<OperationsPage />, idleApi({ enqueueRun: () => Promise.reject(conflict) }));

    const button = await screen.findByRole('button', { name: 'Run Daily Check now' });
    await vi.waitFor(() => {
      expect(button).toBeEnabled();
    });
    fireEvent.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not start the Run. Another Run is already in progress: Backfill #3 is running.',
    );
    // The conflict seeds the active Run, so the page shows it and locks the controls.
    expect(await screen.findByText('12 / 40 companies')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('shows a server validation error from the enqueue', async () => {
    renderWithApi(
      <OperationsPage />,
      idleApi({ enqueueRun: () => Promise.reject(new ApiError(400, 'until must not be in the future', null)) }),
    );
    const button = await screen.findByRole('button', { name: 'Run Daily Check now' });
    await vi.waitFor(() => {
      expect(button).toBeEnabled();
    });
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('until must not be in the future');
  });
});

describe('Start Backfill form', () => {
  async function renderReadyForm(enqueueRun: ApiClient['enqueueRun']): Promise<HTMLElement> {
    renderWithApi(<OperationsPage />, idleApi({ enqueueRun }));
    const form = screen.getByRole('form', { name: 'Start Backfill' });
    await within(form).findByRole('option', { name: 'OncoHost' });
    await vi.waitFor(() => {
      expect(within(form).getByRole('button', { name: 'Start Backfill' })).toBeEnabled();
    });
    return form;
  }

  it('starts a Backfill up to today across all active companies by default', async () => {
    const enqueueRun = vi.fn(() => Promise.resolve(buildRun({ type: 'backfill', status: 'queued' })));
    const form = await renderReadyForm(enqueueRun);
    fireEvent.click(within(form).getByRole('button', { name: 'Start Backfill' }));
    await vi.waitFor(() => {
      expect(enqueueRun).toHaveBeenCalledWith({ type: 'backfill' });
    });
  });

  it('sends a date cutoff and the selected companies', async () => {
    const enqueueRun = vi.fn(() => Promise.resolve(buildRun({ type: 'backfill', status: 'queued' })));
    const form = await renderReadyForm(enqueueRun);

    fireEvent.click(within(form).getByLabelText('Up to a date'));
    fireEvent.change(within(form).getByLabelText('Cutoff date'), { target: { value: '2026-09-30' } });
    const companies = within(form).getByRole('listbox');
    const options = within(companies).getAllByRole<HTMLOptionElement>('option');
    for (const option of options) option.selected = option.text !== 'ZutaCore';
    fireEvent.change(companies);
    fireEvent.click(within(form).getByRole('button', { name: 'Start Backfill' }));

    await vi.waitFor(() => {
      expect(enqueueRun).toHaveBeenCalledWith({ type: 'backfill', until: '2026-09-30', companyIds: [4, 5] });
    });
  });

  it('rejects an invalid "days ago" without calling the API', async () => {
    const enqueueRun = vi.fn(() => Promise.resolve(buildRun()));
    const form = await renderReadyForm(enqueueRun);

    fireEvent.click(within(form).getByLabelText('Up to'));
    fireEvent.change(within(form).getByLabelText('Days ago'), { target: { value: '0' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Start Backfill' }));

    expect(within(form).getByRole('alert')).toHaveTextContent('Enter a whole number of days, 1 or more.');
    expect(enqueueRun).not.toHaveBeenCalled();
  });

  it('reports a company list that cannot be loaded', async () => {
    renderWithApi(
      <OperationsPage />,
      idleApi({ listAdminCompanies: () => Promise.reject(new ApiError(500, 'Internal server error', null)) }),
    );
    expect(await screen.findByText('Could not load the company list: Internal server error')).toBeInTheDocument();
  });
});

describe('Run history and collector health', () => {
  it('lists Runs with type, trigger, status, errors and counts', async () => {
    renderWithApi(
      <OperationsPage />,
      idleApi({ listRuns: () => Promise.resolve([failedDailyCheck, dailyCheckWithErrors, completedBackfill]) }),
    );
    const table = await screen.findByRole('table', { name: 'Run history' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);

    expect(rows[0]).toHaveTextContent('Failed');
    expect(rows[0]).toHaveTextContent('Ollama did not answer within 60s');
    expect(rows[1]).toHaveTextContent('Completed with errors');
    expect(rows[1]).toHaveTextContent('2 company errors');
    expect(rows[1]).toHaveTextContent('Schedule');
    expect(rows[1]).toHaveTextContent('3m 28s');
    expect(rows[2]).toHaveTextContent('Backfill');
    expect(rows[2]).toHaveTextContent('until 2026-10-04');
    expect(rows[2]).toHaveTextContent('310 / 310 classified');
  });

  it('renders a Run history error', async () => {
    renderWithApi(<OperationsPage />, idleApi({ listRuns: () => Promise.reject(new NetworkError('offline')) }));
    expect(await screen.findByText(/Could not load the Run history: Cannot reach the server/)).toBeInTheDocument();
  });

  it('shows collector status, state, Ollama and model', async () => {
    renderWithApi(<OperationsPage />, idleApi());
    const health = await screen.findByLabelText('Collector status');
    expect(health).toHaveTextContent('Online');
    expect(health).toHaveTextContent('Idle');
    expect(health).toHaveTextContent('Reachable');
    expect(health).toHaveTextContent('qwen2.5:7b-instruct');
  });

  it('shows an offline collector with Ollama unreachable', async () => {
    renderWithApi(
      <OperationsPage />,
      idleApi({
        getCollectorHealth: () =>
          Promise.resolve({ ...healthyCollector, online: false, ollamaOk: false, detail: 'connect ECONNREFUSED' }),
      }),
    );
    const health = await screen.findByLabelText('Collector status');
    expect(health).toHaveTextContent('Offline');
    expect(health).toHaveTextContent('Unreachable');
    expect(health).toHaveTextContent('connect ECONNREFUSED');
  });

  it('renders a collector health error', async () => {
    renderWithApi(
      <OperationsPage />,
      idleApi({ getCollectorHealth: () => Promise.reject(new ApiError(503, 'Service Unavailable', null)) }),
    );
    expect(await screen.findByText('Could not load collector health: Service Unavailable')).toBeInTheDocument();
  });
});
