import { describe, expect, it } from 'vitest';

import { ApiError, NetworkError } from './apiErrors.ts';
import {
  addChip,
  companyProfileErrorsFrom,
  EMPTY_COMPANY_PROFILE,
  formValuesFromCompany,
  hasChanges,
  removeChip,
  toCreateCompanyRequest,
  toUpdateCompanyRequest,
} from './companyProfileForm.ts';
import { lambdaActive, validationError } from './test/companiesPage.fixtures.ts';

describe('toUpdateCompanyRequest', () => {
  it('is empty when nothing changed', () => {
    const request = toUpdateCompanyRequest(lambdaActive, formValuesFromCompany(lambdaActive));
    expect(request).toEqual({});
    expect(hasChanges(request)).toBe(false);
  });

  it('carries only the changed fields, trimmed, with blank text as null', () => {
    const values = { ...formValuesFromCompany(lambdaActive), description: '  GPU cloud  ', domain: '  ', aliases: ['Lambda Labs'] };
    const request = toUpdateCompanyRequest(lambdaActive, values);
    expect(request).toEqual({ description: 'GPU cloud', domain: null, aliases: ['Lambda Labs'] });
    expect(hasChanges(request)).toBe(true);
    expect(request).not.toHaveProperty('sourceName');
  });
});

describe('toCreateCompanyRequest', () => {
  it('maps blank text to null and never sends a Source Name', () => {
    const request = toCreateCompanyRequest({ ...EMPTY_COMPANY_PROFILE, displayName: ' Glean ', searchTerms: ['Glean AI'] });
    expect(request).toEqual({ displayName: 'Glean', description: null, domain: null, aliases: [], searchTerms: ['Glean AI'] });
    expect(request).not.toHaveProperty('sourceName');
  });
});

describe('chips', () => {
  it('adds trimmed values and ignores blanks and case-insensitive duplicates', () => {
    const chips = ['Edge'];
    expect(addChip(chips, '  Ludeo ')).toEqual(['Edge', 'Ludeo']);
    expect(addChip(chips, '   ')).toBe(chips);
    expect(addChip(chips, 'edge')).toBe(chips);
  });

  it('removes a value', () => {
    expect(removeChip(['Edge', 'Ludeo'], 'Edge')).toEqual(['Ludeo']);
  });
});

describe('companyProfileErrorsFrom', () => {
  it('assigns ValidationPipe messages to the field they name and keeps the rest general', () => {
    const errors = companyProfileErrorsFrom(
      validationError([
        'displayName should not be empty',
        'domain must be a valid domain name',
        'each value in searchTerms must be a string',
        'property website should not exist',
      ]),
    );
    expect(errors.fields).toEqual({
      displayName: ['displayName should not be empty'],
      domain: ['domain must be a valid domain name'],
      searchTerms: ['each value in searchTerms must be a string'],
    });
    expect(errors.general).toEqual(['property website should not exist']);
  });

  it('treats a single-message error (e.g. a 409 duplicate name) as general unless it names a field', () => {
    const conflict = new ApiError(409, 'A company with this name already exists', {
      statusCode: 409,
      message: 'A company with this name already exists',
    });
    expect(companyProfileErrorsFrom(conflict)).toEqual({ fields: {}, general: ['A company with this name already exists'] });
  });

  it('falls back to the error message when the body has none', () => {
    expect(companyProfileErrorsFrom(new ApiError(500, 'Request failed with status 500', null)).general).toEqual([
      'Request failed with status 500',
    ]);
    expect(companyProfileErrorsFrom(new NetworkError('offline')).general).toEqual(['offline']);
  });
});
