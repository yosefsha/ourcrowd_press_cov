import { NavLink, Outlet, useSearchParams } from 'react-router';

import { COVERAGE_WINDOW_PARAM, useCoverageWindow } from '../hooks/useCoverageWindow.ts';
import { AlertBell } from './AlertBell.tsx';
import { AsOfIndicator } from './AsOfIndicator.tsx';
import { CoverageWindowSelector } from './CoverageWindowSelector.tsx';

interface NavItem {
  readonly to: string;
  readonly label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Overview' },
  { to: '/companies', label: 'Companies' },
  { to: '/operations', label: 'Operations' },
];

/** Keeps the Coverage Window when moving between pages; page-specific filters stay behind. */
function navSearch(searchParams: URLSearchParams): string {
  const window = searchParams.get(COVERAGE_WINDOW_PARAM);
  return window === null ? '' : `?${new URLSearchParams({ [COVERAGE_WINDOW_PARAM]: window }).toString()}`;
}

/** Top bar (title, navigation, Coverage Window, "as of", alert bell) around the routed page. */
export function AppShell(): React.JSX.Element {
  const [coverageWindow, setCoverageWindow] = useCoverageWindow();
  const [searchParams] = useSearchParams();
  const search = navSearch(searchParams);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 24,
          padding: '12px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #d9e2ec',
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 600 }}>Press Coverage</span>
        <nav aria-label="Main" style={{ display: 'flex', gap: 16 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search }}
              end={item.to === '/'}
              style={({ isActive }) => ({
                color: isActive ? '#102a43' : '#486581',
                fontWeight: isActive ? 600 : 400,
                textDecoration: 'none',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
          <CoverageWindowSelector value={coverageWindow} onChange={setCoverageWindow} />
          <AsOfIndicator coverageWindow={coverageWindow} />
          <AlertBell />
        </div>
      </header>
      <main style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
