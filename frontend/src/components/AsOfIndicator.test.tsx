import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NetworkError } from '../apiErrors.ts';
import { RUN_HISTORY_LIMIT, formatDateTime } from '../runs.ts';
import {
  completedBackfill,
  dailyCheckWithErrors,
  failedDailyCheck,
  renderWithApi,
} from '../test/alertsOperationsFixtures.tsx';
import { AsOfIndicator } from './AsOfIndicator.tsx';

describe('AsOfIndicator', () => {
  it('shows when the latest completed Run finished', async () => {
    const listRuns = vi.fn(() => Promise.resolve([failedDailyCheck, dailyCheckWithErrors, completedBackfill]));
    renderWithApi(<AsOfIndicator coverageWindow="rolling90" />, { listRuns });
    expect(
      await screen.findByText(`As of ${formatDateTime(dailyCheckWithErrors.finishedAt ?? '')}`),
    ).toBeInTheDocument();
    expect(listRuns).toHaveBeenCalledWith({ limit: RUN_HISTORY_LIMIT });
  });

  it('says so before the first completed Run', async () => {
    renderWithApi(<AsOfIndicator coverageWindow="rolling90" />, { listRuns: () => Promise.resolve([failedDailyCheck]) });
    expect(await screen.findByText('No completed Run yet')).toBeInTheDocument();
  });

  it('renders an error when the Run history cannot be loaded', async () => {
    renderWithApi(<AsOfIndicator coverageWindow="rolling90" />, {
      listRuns: () => Promise.reject(new NetworkError('offline')),
    });
    expect(await screen.findByText('As of: unavailable')).toBeInTheDocument();
  });
});
