import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';

/**
 * The pipeline's name check (#9), which runs before the classifier: only a
 * Candidate whose title or snippet names the company — by display name or any
 * alias, ignoring case, diacritics, spacing and punctuation, as a substring —
 * ever reaches the RelevanceClassifier. The validation set keeps only such
 * Candidates, so it measures exactly what the classifier is asked.
 *
 * Mirrors `pipeline/name-check.ts` from #9, which is not on `main` yet; switch
 * to importing it once it is.
 */
export function namesCompany(profile: CompanyProfile, article: Pick<ClassifiableArticle, 'title' | 'snippet'>): boolean {
  const text = fold(`${article.title} ${article.snippet}`);
  return [profile.displayName, ...profile.aliases].map(fold).some((name) => name !== '' && text.includes(name));
}

function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}
