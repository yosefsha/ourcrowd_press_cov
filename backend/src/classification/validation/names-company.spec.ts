import type { CompanyProfile } from '../../domain/company';
import { namesCompany } from './names-company';

const PROFILE: CompanyProfile = { displayName: 'ZutaCore', aliases: ['זוטהקור'], domain: null, description: null, searchTerms: [] };

describe('namesCompany', () => {
  it('matches the display name ignoring case, spacing and punctuation', () => {
    expect(namesCompany(PROFILE, { title: 'Zuta-Core raises a round', snippet: '' })).toBe(true);
    expect(namesCompany(PROFILE, { title: 'News', snippet: 'about zutacore today' })).toBe(true);
  });

  it('matches an alias, Hebrew prefixes glued on included', () => {
    expect(namesCompany(PROFILE, { title: 'וזוטהקור גייסה', snippet: '' })).toBe(true);
  });

  it('rejects text that never names the company', () => {
    expect(namesCompany(PROFILE, { title: 'Liquid cooling market grows', snippet: 'Data centres' })).toBe(false);
  });
});
