import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../api.ts';
import { ApiError } from '../apiErrors.ts';
import { completedBackfill, dailyCheckWithErrors, renderWithApi } from '../test/alertsOperationsFixtures.tsx';
import type { RunDetail } from '../types.ts';
import { RunHistoryTable } from './RunHistoryTable.tsx';

// PROVISIONAL like the rest of the Operations fixtures: typed against the
// GET /api/runs/:id contract, to be replaced by a recorded response (ADR-006).
const dailyCheckWithErrorsDetail: RunDetail = {
  ...dailyCheckWithErrors,
  companyErrors: [
    { companyId: 12, companyName: 'Harvey', stage: 'collection', message: 'Google News answered 503' },
    { companyId: 31, companyName: 'Island', stage: 'relevance', message: 'Ollama did not answer within 60s' },
  ],
};

describe('RunHistoryTable company errors', () => {
  it('loads and shows the per-company errors of a Run only when asked', async () => {
    const getRun = vi.fn<ApiClient['getRun']>().mockResolvedValue(dailyCheckWithErrorsDetail);
    renderWithApi(<RunHistoryTable runs={[dailyCheckWithErrors, completedBackfill]} error={null} />, { getRun });

    const toggle = screen.getByRole('button', { name: '2 company errors' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(getRun).not.toHaveBeenCalled();

    fireEvent.click(toggle);

    const list = await screen.findByRole('list', { name: 'Company errors in Run #5' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Harvey · Collection: Google News answered 503');
    expect(items[1]).toHaveTextContent('Island · Relevance: Ollama did not answer within 60s');
    expect(getRun).toHaveBeenCalledWith(5);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(screen.queryByRole('list', { name: 'Company errors in Run #5' })).not.toBeInTheDocument();
  });

  it('offers no toggle for a Run without company errors', () => {
    renderWithApi(<RunHistoryTable runs={[completedBackfill]} error={null} />, {});

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows why the company errors could not be loaded', async () => {
    renderWithApi(<RunHistoryTable runs={[dailyCheckWithErrors]} error={null} />, {
      getRun: () => Promise.reject(new ApiError(404, 'Run 5 does not exist', null)),
    });

    fireEvent.click(screen.getByRole('button', { name: '2 company errors' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the company errors: Run 5 does not exist');
  });
});
