import { describe, expect, it } from 'vitest';

import { parseCompanyId, withCompanyId } from './companySelectionParam.ts';

describe('parseCompanyId', () => {
  it('reads a positive integer id', () => {
    expect(parseCompanyId('16')).toBe(16);
  });

  it.each([null, '', '0', '-3', '1.5', '16abc', ' 16', '99999999999999999999'])('rejects %j', (value) => {
    expect(parseCompanyId(value)).toBeNull();
  });
});

describe('withCompanyId', () => {
  it('sets the id and keeps the other parameters', () => {
    expect(withCompanyId(new URLSearchParams('window=2026-Q3'), 16).toString()).toBe('window=2026-Q3&company=16');
  });

  it('removes the parameter for null', () => {
    expect(withCompanyId(new URLSearchParams('company=16&window=2026-Q3'), null).toString()).toBe('window=2026-Q3');
  });
});
