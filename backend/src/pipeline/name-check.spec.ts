import { recordedArticle } from '../../test/pipeline/support/recorded-news';
import type { CompanyProfile } from '../domain/company';
import { foldForNameCheck, namesCompany } from './name-check';

function profile(displayName: string, aliases: readonly string[] = []): CompanyProfile {
  return { displayName, aliases, domain: null, description: null, searchTerms: [] };
}

function article(title: string, snippet = ''): Parameters<typeof namesCompany>[1] {
  return { title, snippet, outletName: 'Outlet', publishedAt: new Date('2026-07-28T07:00:00Z'), language: 'en' };
}

describe('foldForNameCheck', () => {
  it.each([
    ['ZutaCore', 'zutacore'],
    ['Zuta-Core', 'zutacore'],
    ['  ZUTA core ', 'zutacore'],
    ['Café Señor', 'cafesenor'],
    ['אִינוֹוִיז', 'אינוויז'],
    ['People.ai', 'peopleai'],
    ['ﬁnance', 'finance'],
    ['!!!', ''],
  ])('folds %j to %j', (text, folded) => {
    expect(foldForNameCheck(text)).toBe(folded);
  });
});

describe('namesCompany', () => {
  it('finds the display name in a recorded title, ignoring case', () => {
    expect(namesCompany(profile('CEREBRAS'), recordedArticle('Cerebras stock gains on AMD partnership'))).toBe(true);
  });

  it('rejects a recorded title that misspells the name ("Cerbras")', () => {
    const typo = recordedArticle('AMD and Cerbras form a partnership that makes chips faster and more efficient.');
    expect(namesCompany(profile('Cerebras'), typo)).toBe(false);
  });

  it('finds a Hebrew alias in a recorded Hebrew title, with a prefix glued on', () => {
    const hebrew = recordedArticle('מניות אינוויז צונחות ב-30%: מגייסת 30 מיליון דולר בדיסקאונט חד');
    expect(namesCompany(profile('Innoviz', ['אינוויז']), hebrew)).toBe(true);
    expect(namesCompany(profile('Innoviz'), hebrew)).toBe(false);
  });

  it('ignores niqqud on either side', () => {
    expect(namesCompany(profile('Innoviz', ['אִינוֹוִיז']), article('אינוויז שוב מגייסת'))).toBe(true);
    expect(namesCompany(profile('Innoviz', ['אינוויז']), article('אִינוֹוִיז שוב מגייסת'))).toBe(true);
  });

  it('ignores Latin diacritics', () => {
    expect(namesCompany(profile('Hailo'), article('Haïlo ships a new chip'))).toBe(true);
  });

  it('rejects a recorded Hebrew title that never names the company', () => {
    const unnamed = recordedArticle('הישראלית שצנחה אתמול ב-30%: והחלום שהיא עוד מנסה למכור');
    expect(namesCompany(profile('Innoviz', ['אינוויז']), unnamed)).toBe(false);
  });

  it('matches the snippet as well as the title, and any alias', () => {
    expect(namesCompany(profile('Ludeo', ['Edge']), article('Cloud gaming startup raises', 'Formerly EDGE, the company…'))).toBe(true);
  });

  it('never matches a name that folds to nothing', () => {
    expect(namesCompany(profile('***'), article('*** anything ***'))).toBe(false);
  });
});
