import type { AmbiguityAssessment } from '../../classification/ambiguity-triage';
import { COMMON_ENGLISH_WORDS } from './word-lists/common-english-words';
import { FIRST_NAMES } from './word-lists/first-names';

/** Names this short match too much unrelated text to search for as they are. */
export const MAX_AMBIGUOUS_LENGTH = 3;

/**
 * The rule half of the import triage (ADR-010): a name is possibly ambiguous
 * when it is at most three characters long, or a single word that is a common
 * English word or a common first name. Returns null when no rule applies.
 */
export function assessNameByRules(name: string): AmbiguityAssessment | null {
  const trimmed = name.trim();
  if (trimmed.length <= MAX_AMBIGUOUS_LENGTH) {
    return {
      ambiguous: true,
      reason: `"${trimmed}" is only ${trimmed.length} characters long, so a news search for it would mostly match unrelated text.`,
    };
  }
  if (/\s/.test(trimmed)) return null;
  const word = trimmed.toLowerCase();
  if (FIRST_NAMES.has(word)) {
    return {
      ambiguous: true,
      reason: `"${trimmed}" is a common first name, so a news search for it would mostly return unrelated people.`,
    };
  }
  if (COMMON_ENGLISH_WORDS.has(word)) {
    return {
      ambiguous: true,
      reason: `"${trimmed}" is a common English word, so a news search for it would mostly return unrelated articles.`,
    };
  }
  return null;
}
