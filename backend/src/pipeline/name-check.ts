import type { ClassifiableArticle } from '../domain/article';
import type { CompanyProfile } from '../domain/company';

/**
 * Folds text for a lenient name comparison: compatibility-decomposed, without
 * combining marks (Latin accents, Hebrew niqqud and cantillation), lower-cased,
 * and with everything but letters and digits removed — so `Zuta-Core`,
 * `zutacore` and `ZutaCore` compare equal, as do `Café` and `cafe`.
 */
export function foldForNameCheck(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * The rule that runs before the classifier: an Article whose title and snippet
 * never name the company — by display name or any alias, ignoring case,
 * diacritics, spacing and punctuation — cannot be a Mention of it.
 *
 * The match is a substring match on purpose. A false "named" only costs one
 * classifier call; a false "absent" loses a Mention. Hebrew prefixes glued to a
 * name (`ואינוויז`, `מניות אינוויז`) therefore still count as naming it.
 */
export function namesCompany(profile: CompanyProfile, article: ClassifiableArticle): boolean {
  const text = foldForNameCheck(`${article.title} ${article.snippet}`);
  return [profile.displayName, ...profile.aliases]
    .map(foldForNameCheck)
    .some((name) => name !== '' && text.includes(name));
}
