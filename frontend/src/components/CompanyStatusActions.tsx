import { useState } from 'react';

import {
  useDeactivateCompanyMutation,
  useMarkCompanyReviewedMutation,
  useSendCompanyToReviewMutation,
} from '../queries.ts';
import type { CompanyStatusAction } from '../companyProfileForm.ts';
import type { AdminCompany } from '../types.ts';
import { dangerButtonStyle, primaryButtonStyle, secondaryButtonStyle } from './companiesPageStyles.ts';

interface Props {
  company: AdminCompany;
  onChanged: (company: AdminCompany, action: CompanyStatusAction) => void;
  /**
   * Why the actions are unavailable right now (e.g. unsaved profile edits), or
   * null. Reviewing with unsaved edits would activate the company without them.
   */
  blockedReason: string | null;
}

/**
 * The lifecycle actions open to a company in its current status. Deactivation
 * is never a delete — history is kept — but it is confirmed in the page first.
 */
export function CompanyStatusActions({ company, onChanged, blockedReason }: Props): React.JSX.Element | null {
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const markReviewed = useMarkCompanyReviewedMutation();
  const sendToReview = useSendCompanyToReviewMutation();
  const deactivate = useDeactivateCompanyMutation();
  const pending =
    markReviewed.isPending || sendToReview.isPending || deactivate.isPending || blockedReason !== null;
  const error = markReviewed.error ?? sendToReview.error ?? deactivate.error;

  if (company.status === 'deactivated') return null;

  return (
    <section aria-label="Status actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {confirmingDeactivate ? (
        <div
          role="group"
          aria-label="Confirm deactivation"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 6, background: '#fff5f5' }}
        >
          <span style={{ fontSize: 14 }}>
            Deactivate {company.displayName}? It will no longer be collected for or shown on the dashboard. Its
            Candidates and Mentions are kept, and it cannot be reactivated — adding it again creates a new company.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                deactivate.mutate(company.id, {
                  onSuccess: (updated) => {
                    setConfirmingDeactivate(false);
                    onChanged(updated, 'deactivated');
                  },
                });
              }}
              style={dangerButtonStyle}
            >
              {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirmingDeactivate(false);
              }}
              style={secondaryButtonStyle}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {company.status === 'needs_review' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                markReviewed.mutate(company.id, {
                  onSuccess: (updated) => {
                    onChanged(updated, 'reviewed');
                  },
                });
              }}
              style={primaryButtonStyle}
            >
              {markReviewed.isPending ? 'Marking…' : 'Mark reviewed'}
            </button>
          )}
          {company.status === 'active' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                sendToReview.mutate(company.id, {
                  onSuccess: (updated) => {
                    onChanged(updated, 'sentToReview');
                  },
                });
              }}
              style={secondaryButtonStyle}
            >
              {sendToReview.isPending ? 'Sending…' : 'Send to Needs Review'}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              markReviewed.reset();
              sendToReview.reset();
              deactivate.reset();
              setConfirmingDeactivate(true);
            }}
            style={dangerButtonStyle}
          >
            Deactivate…
          </button>
        </div>
      )}
      {blockedReason !== null && <p style={{ margin: 0, fontSize: 13, color: '#627d98' }}>{blockedReason}</p>}
      {error !== null && (
        <p role="alert" style={{ margin: 0, fontSize: 14, color: '#ab091e' }}>
          Could not change the status: {error.message}
        </p>
      )}
    </section>
  );
}
