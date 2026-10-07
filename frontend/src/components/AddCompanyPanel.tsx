import { useState } from 'react';

import {
  companyProfileErrorsFrom,
  EMPTY_COMPANY_PROFILE,
  toCreateCompanyRequest,
  type CompanyProfileErrors,
  type CompanyProfileFormValues,
} from '../companyProfileForm.ts';
import { useCreateCompanyMutation } from '../queries.ts';
import type { AdminCompany } from '../types.ts';
import { CompanyProfileForm } from './CompanyProfileForm.tsx';
import { secondaryButtonStyle } from './companiesPageStyles.ts';

interface Props {
  onAdded: (company: AdminCompany) => void;
  onCancel: () => void;
}

/** Add a Tracked Company by hand. It has no Source Name, which marks it as not from the OurCrowd list. */
export function AddCompanyPanel({ onAdded, onCancel }: Props): React.JSX.Element {
  const [values, setValues] = useState<CompanyProfileFormValues>(EMPTY_COMPANY_PROFILE);
  const [errors, setErrors] = useState<CompanyProfileErrors | null>(null);
  const create = useCreateCompanyMutation();

  return (
    <section aria-labelledby="add-company-heading" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 id="add-company-heading" style={{ margin: 0, fontSize: 18 }}>
        Add company
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: '#627d98' }}>
        A company added here has no Source Name, which marks it as not from the OurCrowd list.
      </p>
      <CompanyProfileForm
        values={values}
        onChange={(next) => {
          setValues(next);
          setErrors(null);
        }}
        onSubmit={() => {
          setErrors(null);
          create.mutate(toCreateCompanyRequest(values), {
            onSuccess: onAdded,
            onError: (error) => {
              setErrors(companyProfileErrorsFrom(error));
            },
          });
        }}
        submitLabel="Add company"
        submitDisabled={values.displayName.trim() === ''}
        pending={create.isPending}
        errors={errors}
        secondaryAction={
          <button type="button" onClick={onCancel} disabled={create.isPending} style={secondaryButtonStyle}>
            Cancel
          </button>
        }
      />
    </section>
  );
}
