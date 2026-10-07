import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { AddCompanyPanel } from '../components/AddCompanyPanel.tsx';
import { AdminCompanyList } from '../components/AdminCompanyList.tsx';
import { primaryButtonStyle, secondaryButtonStyle } from '../components/companiesPageStyles.ts';
import { EditCompanyPanel } from '../components/EditCompanyPanel.tsx';
import type { CompanyPanelNotice } from '../companyProfileForm.ts';
import { COMPANY_PARAM, parseCompanyId, withCompanyId } from '../companySelectionParam.ts';
import { useAdminCompaniesQuery } from '../queries.ts';
import type { AdminCompaniesQuery, AdminCompany, TrackedCompanyStatus } from '../types.ts';

type StatusFilter = 'all' | TrackedCompanyStatus;

const STATUS_FILTERS: readonly { readonly value: StatusFilter; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
];

/**
 * The panel's own copy of the open company, from the row clicked or the last mutation's
 * response. It keeps the panel open after the company leaves the filtered list.
 */
interface OpenCompany {
  readonly company: AdminCompany;
  readonly notice: CompanyPanelNotice | null;
}

function toQuery(status: StatusFilter, q: string): AdminCompaniesQuery {
  return { ...(status !== 'all' && { status }), ...(q !== '' && { q }) };
}

/**
 * The company to show for the id in the URL: the newer of the panel's own copy and
 * the list's copy (refetched after each mutation), or whichever exists. The panel's
 * copy also covers a company the current filter no longer shows, e.g. one just
 * marked reviewed under "Needs Review"; the list's copy covers an opened link.
 */
function resolveOpenCompany(
  id: number,
  own: AdminCompany | undefined,
  list: readonly AdminCompany[] | undefined,
): AdminCompany | null {
  const listed = list?.find((candidate) => candidate.id === id);
  if (own === undefined) return listed ?? null;
  // Ties go to the panel's copy: a list refetch started before the mutation may finish after it.
  return listed !== undefined && Date.parse(listed.updatedAt) > Date.parse(own.updatedAt) ? listed : own;
}

/** Review and edit Tracked Companies and their Company Profiles (ADR-010). */
export function CompaniesPage(): React.JSX.Element {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<OpenCompany | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = adding ? null : parseCompanyId(searchParams.get(COMPANY_PARAM));

  const companies = useAdminCompaniesQuery(toQuery(status, search));
  const needsReview = useAdminCompaniesQuery({ status: 'needs_review' });
  const needsReviewCount = needsReview.data?.length;

  const own = open !== null && open.company.id === openId ? open : null;
  const editedCompany = openId === null ? null : resolveOpenCompany(openId, own?.company, companies.data);

  const setOpenId = (id: number | null): void => {
    setSearchParams((current) => withCompanyId(current, id));
  };
  const showCompany = (company: AdminCompany, notice: CompanyPanelNotice | null = null): void => {
    setOpen({ company, notice });
    setAdding(false);
    setOpenId(company.id);
  };
  const closePanel = (): void => {
    setAdding(false);
    setOpenId(null);
  };
  /** Before the list changes, keep the open company (it may have come from a link) in the panel's own copy. */
  const keepOpenCompany = (): void => {
    if (editedCompany !== null) setOpen({ company: editedCompany, notice: own?.notice ?? null });
  };
  const showAllCompanies = (): void => {
    setStatus('all');
    setSearch('');
    setSearchDraft('');
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
            setAdding(true);
            setOpenId(null);
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
                keepOpenCompany();
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
            keepOpenCompany();
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
              if (event.target.value === '') {
                keepOpenCompany();
                setSearch('');
              }
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
          {!adding && openId === null && (
            <p style={{ margin: 0, color: '#627d98' }}>Select a company to review or edit its profile.</p>
          )}
          {adding && (
            <AddCompanyPanel
              onAdded={(company) => {
                showCompany(company, 'added');
              }}
              onCancel={closePanel}
            />
          )}
          {openId !== null && editedCompany !== null && (
            <EditCompanyPanel
              key={editedCompany.id}
              company={editedCompany}
              initialNotice={own?.notice ?? null}
              onCompanyChanged={(company) => {
                setOpen({ company, notice: own?.notice ?? null });
              }}
              onClose={closePanel}
            />
          )}
          {openId !== null && editedCompany === null && companies.isPending && (
            <p style={{ margin: 0 }}>Loading company…</p>
          )}
          {openId !== null && editedCompany === null && !companies.isPending && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ margin: 0 }}>
                {status === 'all' && search === ''
                  ? `There is no company with id ${openId}.`
                  : `Company ${openId} is not in the current list.`}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(status !== 'all' || search !== '') && (
                  <button type="button" onClick={showAllCompanies} style={secondaryButtonStyle}>
                    Show all companies
                  </button>
                )}
                <button type="button" onClick={closePanel} style={secondaryButtonStyle}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
