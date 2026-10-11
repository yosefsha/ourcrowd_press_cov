import { NavLink, Outlet, useSearchParams } from 'react-router';

import { COVERAGE_WINDOW_PARAM, useCoverageWindow } from '../hooks/useCoverageWindow.ts';
import { theme } from '../theme.ts';
import { AlertBell } from './AlertBell.tsx';
import { AsOfIndicator } from './AsOfIndicator.tsx';
import { CoverageWindowSelector } from './CoverageWindowSelector.tsx';
import { OurCrowdLogo } from './OurCrowdLogo.tsx';

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
          padding: '10px 24px',
          background: theme.headerBackground,
          color: theme.headerText,
          borderBottom: `3px solid ${theme.brandBlue}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <OurCrowdLogo height={30} />
          <span
            style={{
              paddingLeft: 14,
              borderLeft: `1px solid ${theme.headerTextMuted}`,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            Press Coverage
          </span>
        </div>
        <nav aria-label="Main" style={{ display: 'flex', gap: 20 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search }}
              end={item.to === '/'}
              style={({ isActive }) => ({
                color: isActive ? theme.headerText : theme.headerTextMuted,
                fontWeight: isActive ? 600 : 400,
                textDecoration: 'none',
                padding: '4px 0',
                borderBottom: `2px solid ${isActive ? theme.brandBlue : 'transparent'}`,
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
