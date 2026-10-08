import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { RelevanceVerdict } from '../../domain/relevance';
import type { JsonSchema, StructuredChatRequest } from '../ollama/structured-chat';
import { COMMON_RULES, describeArticle, describeCompany, isRecord, readReason, REASON_SCHEMA } from './prompt-parts';

/**
 * Relevance prompt (ADR-002, step 1): is this Candidate actually about this
 * Tracked Company? Bump the version on any change to the text, the user
 * message layout or the schema; recorded verdicts carry the version they were
 * recorded with.
 */
export const RELEVANCE_PROMPT_VERSION = 'relevance-v1';

export const RELEVANCE_SYSTEM_PROMPT = `You check press coverage for a venture capital portfolio. You decide whether one news article is about one specific company.

An article is relevant when it reports on the company itself: its products, funding, deals, people acting for it, results, legal matters, or when the company is a meaningful subject of the story. It is not relevant when the matching name refers to something else (a person, a place, a storm, a different company with the same or a similar name, a common word), or when the company is only listed in passing without anything said about it.

Use the company's description, aliases and website domain to tell it apart from others with the same name. When the article gives no sign that it means this company and the name is a common word or name, answer not relevant.

Examples (article titles are illustrative):
- Company "Harvey" (AI platform for law firms). Article "Hurricane Harvey recovery funds still unspent years later" → {"relevant": false, "reason": "About Hurricane Harvey, not the legal AI company"}
- Company "Harvey" (AI platform for law firms). Article "Law firm adopts Harvey AI assistant for contract review" → {"relevant": true, "reason": "Reports a customer using the legal AI company's product"}
- Company "Wave" (fintech for small businesses). Article "Heat wave grips southern Europe" → {"relevant": false, "reason": "About weather, not the company Wave"}

${COMMON_RULES}`;

export const RELEVANCE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { relevant: { type: 'boolean' }, reason: REASON_SCHEMA },
  required: ['relevant', 'reason'],
  additionalProperties: false,
};

export function buildRelevanceRequest(company: CompanyProfile, article: ClassifiableArticle): StructuredChatRequest {
  return {
    system: RELEVANCE_SYSTEM_PROMPT,
    user: `${describeCompany(company)}\n\nArticle:\n${describeArticle(article)}\n\nIs this article about this company?`,
    schema: RELEVANCE_SCHEMA,
  };
}

export function parseRelevanceVerdict(value: unknown): RelevanceVerdict | undefined {
  if (!isRecord(value) || typeof value.relevant !== 'boolean') return undefined;
  const reason = readReason(value.reason);
  return reason === undefined ? undefined : { relevant: value.relevant, reason };
}
