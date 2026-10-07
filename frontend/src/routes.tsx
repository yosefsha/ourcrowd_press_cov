import type { RouteObject } from 'react-router';

import { AppShell } from './components/AppShell.tsx';
import { CompaniesPage } from './pages/CompaniesPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { OperationsPage } from './pages/OperationsPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';

/** Every page renders inside the shell; each page lives in its own file. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'companies', element: <CompaniesPage /> },
      { path: 'operations', element: <OperationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
