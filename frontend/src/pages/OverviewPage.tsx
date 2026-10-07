import { CompanyDetailPanel } from '../components/CompanyDetailPanel.tsx';
import { CompanyFilters } from '../components/CompanyFilters.tsx';
import { CompanyTable } from '../components/CompanyTable.tsx';
import { QueryErrorMessage } from '../components/QueryErrorMessage.tsx';
import { SummaryStrip } from '../components/SummaryStrip.tsx';
import { useCoverageWindow } from '../hooks/useCoverageWindow.ts';
import { useDisplayedDataTime } from '../hooks/useDisplayedDataTime.ts';
import { useOverviewFilters, useSelectedCompany } from '../hooks/useOverviewFilters.ts';
import { hasActiveFilters, toCompaniesQuery } from '../overviewFilters.ts';
import { useCompaniesQuery, useSummaryQuery } from '../queries.ts';

const statusTextStyle: React.CSSProperties = { margin: 0, padding: '24px 0', color: '#486581' };

/** The main dashboard view: summary strip and company table for the shell's Coverage Window. */
export function OverviewPage(): React.JSX.Element {
  const [coverageWindow] = useCoverageWindow();
  const [filters, updateFilters] = useOverviewFilters();
  const [selectedCompanyId, selectCompany] = useSelectedCompany();

  const summaryQuery = useSummaryQuery(coverageWindow);
  const companiesQuery = useCompaniesQuery(toCompaniesQuery(coverageWindow, filters));
  const rowsFetchedAt = useDisplayedDataTime(companiesQuery.dataUpdatedAt, companiesQuery.isPlaceholderData);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Overview</h1>

      {summaryQuery.isPending ? (
        <p style={{ margin: 0, color: '#486581' }}>Loading summary…</p>
      ) : summaryQuery.isError ? (
        <QueryErrorMessage
          subject="the summary"
          error={summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : (
        <SummaryStrip
          summary={summaryQuery.data}
          selectedStatus={filters.status}
          hasNegatives={filters.hasNegatives}
          onSelectStatus={(status) => {
            updateFilters({ status });
          }}
          onToggleNegatives={(hasNegatives) => {
            updateFilters({ hasNegatives });
          }}
        />
      )}

      <CompanyFilters filters={filters} onChange={updateFilters} />

      {companiesQuery.isPending ? (
        <p style={statusTextStyle}>Loading companies…</p>
      ) : companiesQuery.isError ? (
        <QueryErrorMessage
          subject="the companies"
          error={companiesQuery.error}
          onRetry={() => void companiesQuery.refetch()}
        />
      ) : companiesQuery.data.length === 0 ? (
        <p style={statusTextStyle}>
          {hasActiveFilters(filters) ? 'No companies match these filters.' : 'No Tracked Companies yet.'}
        </p>
      ) : (
        <div
          aria-busy={companiesQuery.isPlaceholderData}
          style={{ opacity: companiesQuery.isPlaceholderData ? 0.6 : 1, transition: 'opacity 150ms' }}
        >
          <CompanyTable
            rows={companiesQuery.data}
            sort={filters.sort}
            onSortChange={(sort) => {
              updateFilters({ sort });
            }}
            onSelectCompany={selectCompany}
            now={rowsFetchedAt}
            noCoverageSince={summaryQuery.data?.from ?? null}
          />
        </div>
      )}

      {selectedCompanyId === null ? null : (
        <CompanyDetailPanel
          companyId={selectedCompanyId}
          coverageWindow={coverageWindow}
          onClose={() => {
            selectCompany(null);
          }}
        />
      )}
    </section>
  );
}
