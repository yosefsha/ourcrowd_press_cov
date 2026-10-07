import { useState } from 'react';

import { AddCompanyPanel } from '../components/AddCompanyPanel.tsx';
import { AdminCompanyList } from '../components/AdminCompanyList.tsx';
import { primaryButtonStyle, secondaryButtonStyle } from '../components/companiesPageStyles.ts';
import { EditCompanyPanel, type CompanyPanelNotice } from '../components/EditCompanyPanel.tsx';
import { useAdminCompaniesQuery } from '../queries.ts';
import type { AdminCompaniesQuery, AdminCompany, TrackedCompanyStatus } from '../types.ts';

type StatusFilter = 'all' | TrackedCompanyStatus;

const STATUS_FILTERS: readonly { readonly value: StatusFilter; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
];

/** What the right-hand panel shows. An edited company is kept so it stays open after leaving the filtered list. */
type Panel =
  | { readonly kind: 'none' }
  | { readonly kind: 'add' }
  | { readonly kind: 'edit'; readonly company: AdminCompany; readonly notice: CompanyPanelNotice | null };

function toQuery(status: StatusFilter, q: string): AdminCompaniesQuery {
  return { ...(status !== 'all' && { status }), ...(q !== '' && { q }) };
}

/**
 * The newer of the panel's own copy (set from each mutation's response) and the
 * list's copy (refetched after it); the panel's copy also covers a company the
 * current filter no longer shows, e.g. one just marked reviewed under "Needs Review".
 */
function freshest(company: AdminCompany, list: readonly AdminCompany[] | undefined): AdminCompany {
  const listed = list?.find((candidate) => candidate.id === company.id);
  return listed !== undefined && listed.updatedAt >= company.updatedAt ? listed : company;
}

/** Review and edit Tracked Companies and their Company Profiles (ADR-010). */
export function CompaniesPage(): React.JSX.Element {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });

  const companies = useAdminCompaniesQuery(toQuery(status, search));
  const needsReview = useAdminCompaniesQuery({ status: 'needs_review' });
  const needsReviewCount = needsReview.data?.length;

  const editedCompany = panel.kind === 'edit' ? freshest(panel.company, companies.data) : null;

  const showCompany = (company: AdminCompany, notice: CompanyPanelNotice | null = null): void => {
    setPanel({ kind: 'edit', company, notice });
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Companies</h1>
        {needsReviewCount !== undefined && (
          <span
            role="status"
            style={{
              padding: '2px 10px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: needsReviewCount > 0 ? '#ffe8b3' : '#e4e7eb',
              color: needsReviewCount > 0 ? '#8d2b0b' : '#52606d',
            }}
          >
            {needsReviewCount === 1 ? '1 company needs review' : `${needsReviewCount} companies need review`}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setPanel({ kind: 'add' });
          }}
          style={{ ...primaryButtonStyle, marginLeft: 'auto' }}
        >
          Add company
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <div role="group" aria-label="Status" style={{ display: 'flex', gap: 4 }}>
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={status === filter.value}
              onClick={() => {
                setStatus(filter.value);
              }}
              style={{
                ...secondaryButtonStyle,
                ...(status === filter.value && { background: '#243b53', color: '#ffffff', borderColor: '#243b53' }),
                ...(filter.value === 'needs_review' && status !== filter.value && { borderColor: '#f0b429' }),
              }}
            >
              {filter.value === 'needs_review' && needsReviewCount !== undefined
                ? `${filter.label} (${needsReviewCount})`
                : filter.label}
            </button>
          ))}
        </div>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchDraft.trim());
          }}
          style={{ display: 'flex', gap: 4 }}
        >
          <input
            type="search"
            aria-label="Search companies"
            placeholder="Name, alias or Source Name"
            value={searchDraft}
            onChange={(event) => {
              setSearchDraft(event.target.value);
              if (event.target.value === '') setSearch('');
            }}
            style={{ padding: '6px 8px', border: '1px solid #bcccdc', borderRadius: 4, minWidth: 220 }}
          />
          <button type="submit" style={secondaryButtonStyle}>
            Search
          </button>
        </form>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div>
          {companies.isPending && <p style={{ margin: 0 }}>Loading companies…</p>}
          {companies.isError && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ab091e' }}>
              <span>Could not load companies: {companies.error.message}</span>
              <button
                type="button"
                onClick={() => {
                  void companies.refetch();
                }}
                style={secondaryButtonStyle}
              >
                Retry
              </button>
            </div>
          )}
          {companies.isSuccess && (
            <AdminCompanyList
              companies={companies.data}
              selectedId={editedCompany?.id ?? null}
              onSelect={(company) => {
                showCompany(company);
              }}
            />
          )}
        </div>

        <div style={{ padding: 16, borderRadius: 8, background: '#ffffff', border: '1px solid #d9e2ec' }}>
          {panel.kind === 'none' && (
            <p style={{ margin: 0, color: '#627d98' }}>Select a company to review or edit its profile.</p>
          )}
          {panel.kind === 'add' && (
            <AddCompanyPanel
              onAdded={(company) => {
                showCompany(company, 'added');
              }}
              onCancel={() => {
                setPanel({ kind: 'none' });
              }}
            />
          )}
          {panel.kind === 'edit' && editedCompany !== null && (
            <EditCompanyPanel
              key={editedCompany.id}
              company={editedCompany}
              initialNotice={panel.notice}
              onCompanyChanged={(company) => {
                setPanel({ kind: 'edit', company, notice: panel.notice });
              }}
              onClose={() => {
                setPanel({ kind: 'none' });
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
