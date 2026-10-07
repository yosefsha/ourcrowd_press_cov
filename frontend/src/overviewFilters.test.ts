import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COMPANY_SORT,
  hasActiveFilters,
  parseCompanyId,
  parseOverviewFilters,
  toCompaniesQuery,
  writeOverviewFilters,
} from './overviewFilters.ts';

describe('parseOverviewFilters', () => {
  it('reads an empty query as the default view', () => {
    expect(parseOverviewFilters(new URLSearchParams())).toEqual({
      status: null,
      hasNegatives: false,
      q: '',
      sort: DEFAULT_COMPANY_SORT,
    });
  });

  it('reads every filter from the URL', () => {
    const params = new URLSearchParams('status=quiet&hasNegatives=true&q=%20onco%20&sort=mentions');
    expect(parseOverviewFilters(params)).toEqual({ status: 'quiet', hasNegatives: true, q: 'onco', sort: 'mentions' });
  });

  it('falls back to defaults on malformed values', () => {
    const params = new URLSearchParams('status=dormant&hasNegatives=yes&sort=random');
    expect(parseOverviewFilters(params)).toEqual({ status: null, hasNegatives: false, q: '', sort: 'negatives' });
  });
});

describe('writeOverviewFilters', () => {
  it('writes changed filters and keeps unrelated parameters', () => {
    const next = writeOverviewFilters(new URLSearchParams('window=2026-Q3&company=4'), {
      status: 'active',
      hasNegatives: true,
      q: ' zuta ',
      sort: 'name',
    });
    expect(Object.fromEntries(next)).toEqual({
      window: '2026-Q3',
      company: '4',
      status: 'active',
      hasNegatives: 'true',
      q: 'zuta',
      sort: 'name',
    });
  });

  it('removes defaults from the URL instead of spelling them out', () => {
    const next = writeOverviewFilters(new URLSearchParams('status=active&hasNegatives=true&q=zuta&sort=name'), {
      status: null,
      hasNegatives: false,
      q: '  ',
      sort: 'negatives',
    });
    expect(next.toString()).toBe('');
  });

  it('does not mutate its input', () => {
    const current = new URLSearchParams('q=zuta');
    writeOverviewFilters(current, { q: '' });
    expect(current.toString()).toBe('q=zuta');
  });
});

describe('toCompaniesQuery', () => {
  it('omits unset filters and always sends the sort', () => {
    expect(toCompaniesQuery('rolling90', parseOverviewFilters(new URLSearchParams()))).toEqual({
      window: 'rolling90',
      sort: 'negatives',
    });
  });

  it('includes every set filter', () => {
    const filters = { status: 'recent', hasNegatives: true, q: 'onco', sort: 'recency' } as const;
    expect(toCompaniesQuery('2026-Q2', filters)).toEqual({
      window: '2026-Q2',
      status: 'recent',
      hasNegatives: true,
      q: 'onco',
      sort: 'recency',
    });
  });
});

describe('hasActiveFilters', () => {
  it('ignores the sort order', () => {
    expect(hasActiveFilters({ status: null, hasNegatives: false, q: '', sort: 'name' })).toBe(false);
    expect(hasActiveFilters({ status: null, hasNegatives: false, q: 'x', sort: 'negatives' })).toBe(true);
  });
});

describe('parseCompanyId', () => {
  it.each([
    ['42', 42],
    [null, null],
    ['', null],
    ['0', null],
    ['-3', null],
    ['4.5', null],
    ['abc', null],
    ['99999999999999999999', null],
  ])('parses %j as %j', (value, expected) => {
    expect(parseCompanyId(value)).toBe(expected);
  });
});
