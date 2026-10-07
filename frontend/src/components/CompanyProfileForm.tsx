import type { ReactNode } from 'react';

import type { CompanyProfileErrors, CompanyProfileFormValues } from '../companyProfileForm.ts';
import { ChipInput } from './ChipInput.tsx';
import { primaryButtonStyle } from './companiesPageStyles.ts';
import { ProfileTextField } from './ProfileTextField.tsx';

interface Props {
  values: CompanyProfileFormValues;
  onChange: (values: CompanyProfileFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled: boolean;
  pending: boolean;
  /** The server's answer to the last submit, if it was rejected. */
  errors: CompanyProfileErrors | null;
  /** Rendered next to the submit button (e.g. Cancel). */
  secondaryAction?: ReactNode;
}

/** The editable Company Profile fields. The Source Name is never part of it. */
export function CompanyProfileForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  submitDisabled,
  pending,
  errors,
  secondaryAction,
}: Props): React.JSX.Element {
  const set = <K extends keyof CompanyProfileFormValues>(field: K, value: CompanyProfileFormValues[K]): void => {
    onChange({ ...values, [field]: value });
  };
  const fieldErrors = errors?.fields ?? {};

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Locked while saving, so nothing typed meanwhile is overwritten by the server's answer. */}
      <fieldset
        disabled={pending}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, border: 'none', margin: 0, padding: 0, minWidth: 0 }}
      >
      <ProfileTextField
        label="Display name"
        value={values.displayName}
        onChange={(value) => {
          set('displayName', value);
        }}
        errors={fieldErrors.displayName}
      />
      <ProfileTextField
        label="Description"
        hint="One line on what the company does — it helps tell its news apart from unrelated uses of the name."
        multiline
        value={values.description}
        onChange={(value) => {
          set('description', value);
        }}
        errors={fieldErrors.description}
      />
      <ProfileTextField
        label="Domain"
        hint="e.g. lambda.ai"
        value={values.domain}
        onChange={(value) => {
          set('domain', value);
        }}
        errors={fieldErrors.domain}
      />
      <ChipInput
        label="Aliases"
        itemNoun="alias"
        hint="Other names, including former ones."
        values={values.aliases}
        onChange={(value) => {
          set('aliases', value);
        }}
        errors={fieldErrors.aliases}
      />
      <ChipInput
        label="Search terms"
        itemNoun="search term"
        hint="What the News Source searches for, chosen to exclude unrelated uses of the name."
        values={values.searchTerms}
        onChange={(value) => {
          set('searchTerms', value);
        }}
        errors={fieldErrors.searchTerms}
      />
      </fieldset>
      {errors !== null && errors.general.length > 0 && (
        <div role="alert" style={{ color: '#ab091e', fontSize: 14 }}>
          {errors.general.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitDisabled || pending} style={primaryButtonStyle}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        {secondaryAction}
      </div>
    </form>
  );
}
