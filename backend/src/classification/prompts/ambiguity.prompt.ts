import type { AmbiguityAssessment } from '../ambiguity-triage';
import type { JsonSchema, StructuredChatRequest } from '../ollama/structured-chat';
import { COMMON_RULES, isRecord, readReason, REASON_SCHEMA } from './prompt-parts';

/**
 * Ambiguity triage prompt (ADR-010): asked once per company at import. A
 * company judged ambiguous starts as Needs Review, so the prompt leans towards
 * flagging. Bump the version on any change to the text or the schema.
 */
export const AMBIGUITY_PROMPT_VERSION = 'ambiguity-v1';

export const AMBIGUITY_SYSTEM_PROMPT = `You help set up press monitoring for startup companies. You are given only a company name. Decide whether a news search for this exact name would mostly return articles that are not about a startup with that name.

Flag the name as ambiguous when it is, or closely matches, a common English or Hebrew word, a common first name or surname, a place, a famous person, event or brand, or a very short name or abbreviation that appears inside many other words. A distinctive invented word is not ambiguous. When in any doubt, flag it as ambiguous: a person will review it, and missing an ambiguous name is worse than reviewing a clear one.

Examples:
- "Harvey" → {"ambiguous": true, "reason": "Common first name; also Hurricane Harvey and Harvey Weinstein"}
- "Wave" → {"ambiguous": true, "reason": "Common English word used in many unrelated stories"}
- "ZutaCore" → {"ambiguous": false, "reason": "Distinctive invented name unlikely to match other topics"}

${COMMON_RULES}`;

export const AMBIGUITY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { ambiguous: { type: 'boolean' }, reason: REASON_SCHEMA },
  required: ['ambiguous', 'reason'],
  additionalProperties: false,
};

export function buildAmbiguityRequest(name: string): StructuredChatRequest {
  return {
    system: AMBIGUITY_SYSTEM_PROMPT,
    user: `Company name: ${name.trim()}\n\nWould a news search for this exact name mostly return unrelated articles?`,
    schema: AMBIGUITY_SCHEMA,
  };
}

export function parseAmbiguityAssessment(value: unknown): AmbiguityAssessment | undefined {
  if (!isRecord(value) || typeof value.ambiguous !== 'boolean') return undefined;
  const reason = readReason(value.reason);
  return reason === undefined ? undefined : { ambiguous: value.ambiguous, reason };
}
