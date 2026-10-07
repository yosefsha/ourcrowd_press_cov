/**
 * Pure logic behind the Company Profile form on the Companies page: the form's
 * value object, its mapping to the admin API's request bodies, and the mapping
 * of a server validation error back onto the form's fields.
 */
import { ApiError } from './apiErrors.ts';
import type { AdminCompany, CreateCompanyRequest, UpdateCompanyRequest } from './types.ts';

/** The editable Company Profile fields, as the form holds them (blank text = not set). */
export interface CompanyProfileFormValues {
  readonly displayName: string;
  readonly description: string;
  readonly domain: string;
  readonly aliases: readonly string[];
  readonly searchTerms: readonly string[];
}

export type CompanyProfileField = keyof CompanyProfileFormValues;

export const COMPANY_PROFILE_FIELDS: readonly CompanyProfileField[] = [
  'displayName',
  'description',
  'domain',
  'aliases',
  'searchTerms',
];

export const EMPTY_COMPANY_PROFILE: CompanyProfileFormValues = {
  displayName: '',
  description: '',
  domain: '',
  aliases: [],
  searchTerms: [],
};

/** Errors the server reported for a submitted form, by field, plus any it did not tie to a field. */
export interface CompanyProfileErrors {
  readonly fields: Readonly<Partial<Record<CompanyProfileField, readonly string[]>>>;
  readonly general: readonly string[];
}

export function formValuesFromCompany(company: AdminCompany): CompanyProfileFormValues {
  return {
    displayName: company.displayName,
    description: company.description ?? '',
    domain: company.domain ?? '',
    aliases: company.aliases,
    searchTerms: company.searchTerms,
  };
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** POST body for a company added by hand. It never carries a Source Name. */
export function toCreateCompanyRequest(values: CompanyProfileFormValues): CreateCompanyRequest {
  return {
    displayName: values.displayName.trim(),
    description: textOrNull(values.description),
    domain: textOrNull(values.domain),
    aliases: values.aliases,
    searchTerms: values.searchTerms,
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * PATCH body holding only the fields that differ from the saved company, so an
 * edit never rewrites a field the person did not touch. Empty when nothing changed.
 */
export function toUpdateCompanyRequest(company: AdminCompany, values: CompanyProfileFormValues): UpdateCompanyRequest {
  const displayName = values.displayName.trim();
  const description = textOrNull(values.description);
  const domain = textOrNull(values.domain);
  return {
    ...(displayName !== company.displayName && { displayName }),
    ...(description !== company.description && { description }),
    ...(domain !== company.domain && { domain }),
    ...(!sameList(values.aliases, company.aliases) && { aliases: values.aliases }),
    ...(!sameList(values.searchTerms, company.searchTerms) && { searchTerms: values.searchTerms }),
  };
}

export function hasChanges(request: UpdateCompanyRequest): boolean {
  return Object.keys(request).length > 0;
}

/** Adds a chip value unless it is blank or already present (case-insensitively). */
export function addChip(chips: readonly string[], value: string): readonly string[] {
  const trimmed = value.trim();
  if (trimmed === '') return chips;
  const lower = trimmed.toLocaleLowerCase();
  if (chips.some((chip) => chip.toLocaleLowerCase() === lower)) return chips;
  return [...chips, trimmed];
}

export function removeChip(chips: readonly string[], value: string): readonly string[] {
  return chips.filter((chip) => chip !== value);
}

const FIELD_PATTERN = new RegExp(`\\b(${COMPANY_PROFILE_FIELDS.join('|')})\\b`);

function errorMessages(body: unknown, fallback: string): readonly string[] {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    if (typeof message === 'string' && message !== '') return [message];
    if (Array.isArray(message)) {
      const parts = message.filter((part): part is string => typeof part === 'string' && part !== '');
      if (parts.length > 0) return parts;
    }
  }
  return [fallback];
}

/**
 * Maps a failed save onto the form. NestJS's ValidationPipe answers 400 with
 * `message: string[]`, each message naming its property (`domain must be a valid
 * domain name`, `each value in aliases must be a string`); messages naming a
 * profile field go under it, everything else — and any non-HTTP failure — is general.
 */
export function companyProfileErrorsFrom(error: Error): CompanyProfileErrors {
  if (!(error instanceof ApiError)) return { fields: {}, general: [error.message] };
  const fields: Partial<Record<CompanyProfileField, string[]>> = {};
  const general: string[] = [];
  for (const message of errorMessages(error.body, error.message)) {
    const field = FIELD_PATTERN.exec(message)?.[1] as CompanyProfileField | undefined;
    if (field === undefined) {
      general.push(message);
    } else {
      (fields[field] ??= []).push(message);
    }
  }
  return { fields, general };
}
