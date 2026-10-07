import { useState } from 'react';

import {
  companyProfileErrorsFrom,
  formValuesFromCompany,
  hasChanges,
  toUpdateCompanyRequest,
  type CompanyProfileErrors,
  type CompanyProfileFormValues,
} from '../companyProfileForm.ts';
import { useUpdateCompanyMutation } from '../queries.ts';
import type { AdminCompany } from '../types.ts';
import { CompanyProfileForm } from './CompanyProfileForm.tsx';
import { CompanyStatusActions, type CompanyStatusAction } from './CompanyStatusActions.tsx';
import { CompanyStatusBadge } from './CompanyStatusBadge.tsx';
import { secondaryButtonStyle } from './companiesPageStyles.ts';
import { ReprocessControl } from './ReprocessControl.tsx';

/** What just happened to the company, so the panel can say so and offer Re-process where it applies. */
export type CompanyPanelNotice = 'added' | 'saved' | CompanyStatusAction;

interface Props {
  company: AdminCompany;
  initialNotice?: CompanyPanelNotice | null;
  onCompanyChanged: (company: AdminCompany) => void;
  onClose: () => void;
}

const NOTICE_TEXT: Readonly<Record<CompanyPanelNotice, string>> = {
  added: 'Company added. It has no coverage yet — Re-process queues a Backfill limited to it.',
  saved: 'Profile saved. It applies to future Runs; Re-process to apply it to the coverage already collected.',
  reviewed: 'Marked reviewed — the company is active and will be collected. Re-process to collect its coverage now.',
  sentToReview: 'Sent to Needs Review — no news is collected for it until it is reviewed again.',
  deactivated: 'Deactivated. Its history is kept, but it is no longer collected for or shown on the dashboard.',
};

/** Notices after which Re-process is the natural next step (ADR-010). */
const OFFERS_REPROCESS: ReadonlySet<CompanyPanelNotice> = new Set(['added', 'saved', 'reviewed']);

/**
 * Edit one Tracked Company: its read-only Source Name, its Company Profile,
 * its lifecycle actions and Re-process. Mount with `key={company.id}` so the
 * form starts from each company's saved profile.
 */
export function EditCompanyPanel({
  company,
  initialNotice = null,
  onCompanyChanged,
  onClose,
}: Props): React.JSX.Element {
  const [values, setValues] = useState<CompanyProfileFormValues>(() => formValuesFromCompany(company));
  const [errors, setErrors] = useState<CompanyProfileErrors | null>(null);
  const [notice, setNotice] = useState<CompanyPanelNotice | null>(initialNotice);
  const update = useUpdateCompanyMutation();
  const changes = toUpdateCompanyRequest(company, values);
  const headingId = `company-${company.id}-heading`;

  function save(): void {
    setErrors(null);
    update.mutate(
      { id: company.id, changes },
      {
        onSuccess: (updated) => {
          setValues(formValuesFromCompany(updated));
          setNotice('saved');
          onCompanyChanged(updated);
        },
        onError: (error) => {
          setErrors(companyProfileErrorsFrom(error));
        },
      },
    );
  }

  return (
    <section aria-labelledby={headingId} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 id={headingId} style={{ margin: 0, fontSize: 18 }}>
          {company.displayName}
        </h2>
        <CompanyStatusBadge status={company.status} />
        <button type="button" onClick={onClose} style={{ ...secondaryButtonStyle, marginLeft: 'auto' }}>
          Close
        </button>
      </div>

      {company.status === 'needs_review' && (
        <p style={{ margin: 0, padding: 12, borderRadius: 6, background: '#fff8e1', fontSize: 14 }}>
          <strong>Needs review:</strong> {company.reviewReason ?? 'No reason was recorded.'} No news is collected for
          it until its profile is reviewed.
        </p>
      )}

      {notice !== null && (
        <p role="status" style={{ margin: 0, fontSize: 14, color: '#0e7c3a' }}>
          {NOTICE_TEXT[notice]}
        </p>
      )}

      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 12px', fontSize: 14 }}>
        <dt style={{ fontWeight: 600 }}>Source Name</dt>
        <dd style={{ margin: 0 }}>
          {company.sourceName ?? <span style={{ color: '#627d98' }}>None — added by hand</span>}
        </dd>
        {company.coverageCapped && (
          <>
            <dt style={{ fontWeight: 600 }}>Coverage</dt>
            <dd style={{ margin: 0 }}>
              The last collection hit the result cap, so coverage may be incomplete — narrower search terms can help.
            </dd>
          </>
        )}
      </dl>

      <CompanyProfileForm
        values={values}
        onChange={(next) => {
          setValues(next);
          setErrors(null);
        }}
        onSubmit={save}
        submitLabel="Save profile"
        submitDisabled={!hasChanges(changes)}
        pending={update.isPending}
        errors={errors}
      />

      <CompanyStatusActions
        company={company}
        onChanged={(updated, action) => {
          setNotice(action);
          onCompanyChanged(updated);
        }}
      />

      <ReprocessControl
        companyId={company.id}
        displayName={company.displayName}
        enabled={company.status === 'active'}
        highlighted={notice !== null && OFFERS_REPROCESS.has(notice)}
      />
    </section>
  );
}
