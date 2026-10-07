import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ApiClientContext } from '../apiClientContext.ts';
import { routes } from '../routes.tsx';
import { createFakeApiClient } from '../test/fixtures.ts';

function renderAt(path: string): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // Pages read server state through the query hooks, so the shell needs a QueryClient and an in-memory ApiClient.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ApiClientContext.Provider value={createFakeApiClient()}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiClientContext.Provider>,
  );
  return router;
}

describe('AppShell routing', () => {
  it.each([
    ['/', 'Overview'],
    ['/companies', 'Companies'],
    ['/operations', 'Operations'],
  ])('renders %s inside the shell', (path, heading) => {
    renderAt(path);
    expect(screen.getByText('Press Coverage')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown paths, still inside the shell', () => {
    renderAt('/no-such-page');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });

  it('navigates between pages from the top bar', () => {
    const router = renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: 'Operations' }));
    expect(router.state.location.pathname).toBe('/operations');
    expect(screen.getByRole('heading', { level: 1, name: 'Operations' })).toBeInTheDocument();
  });
});

describe('Coverage Window selector', () => {
  it('defaults to the rolling 90 days', () => {
    renderAt('/');
    expect(screen.getByLabelText('Coverage window')).toHaveValue('rolling90');
  });

  it('reads the window from the URL', () => {
    renderAt('/?window=2026-Q3');
    expect(screen.getByLabelText('Coverage window')).toHaveValue('2026-Q3');
  });

  it('falls back to the default on a malformed URL value', () => {
    renderAt('/?window=last-week');
    expect(screen.getByLabelText('Coverage window')).toHaveValue('rolling90');
  });

  it('writes the selection to the URL and keeps it when changing page', () => {
    const router = renderAt('/');
    const select = screen.getByLabelText('Coverage window');
    const quarter = (select as HTMLSelectElement).options[2]?.value ?? '';
    expect(quarter).toMatch(/^\d{4}-Q[1-4]$/);

    fireEvent.change(select, { target: { value: quarter } });
    expect(router.state.location.search).toBe(`?window=${quarter}`);

    fireEvent.click(screen.getByRole('link', { name: 'Companies' }));
    expect(router.state.location.pathname).toBe('/companies');
    expect(router.state.location.search).toBe(`?window=${quarter}`);
    expect(screen.getByLabelText('Coverage window')).toHaveValue(quarter);
  });

  it('drops the parameter when switching back to the default', () => {
    const router = renderAt('/?window=2026-Q3');
    fireEvent.change(screen.getByLabelText('Coverage window'), { target: { value: 'rolling90' } });
    expect(router.state.location.search).toBe('');
  });
});
