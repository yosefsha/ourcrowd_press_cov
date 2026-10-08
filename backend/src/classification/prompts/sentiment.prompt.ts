import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import { isSentiment, SENTIMENTS, type SentimentVerdict } from '../../domain/sentiment';
import type { JsonSchema, StructuredChatRequest } from '../ollama/structured-chat';
import { COMMON_RULES, describeArticle, describeCompany, isRecord, readReason, REASON_SCHEMA } from './prompt-parts';

/**
 * Sentiment prompt (ADR-002, step 2): the Sentiment of a Mention toward the
 * Tracked Company — not the article's overall tone. Bump the version on any
 * change to the text, the user message layout or the schema.
 */
export const SENTIMENT_PROMPT_VERSION = 'sentiment-v1';

export const SENTIMENT_SYSTEM_PROMPT = `You check press coverage for a venture capital portfolio. The article below is known to be about the company. Judge what the article means for the company — positive, negative or neutral toward it — not the general mood of the writing.

- positive: good news for the company, e.g. funding raised, growth, a major customer or partnership, an award, a successful product launch, an acquisition on good terms.
- negative: bad news for the company, e.g. layoffs, losses, a lawsuit or investigation against it, a security breach, an executive leaving under pressure, a shutdown, a down round, criticism of its products.
- neutral: neither, e.g. the company is quoted or mentioned as an example, a routine announcement, a balanced report.

Judge the facts, not the wording: a story about layoffs is negative even when written in calm, neutral language, and a competitor's bad news is not good news for this company unless the article says so.

Examples:
(The company names in these examples are invented.)
- Company "Examplo". Article "Examplo to cut 20% of staff as it refocuses on its core product" → {"sentiment": "negative", "reason": "Reports layoffs at the company"}
- Company "Examplo". Article "Examplo raises Series B to expand its platform" → {"sentiment": "positive", "reason": "Reports new funding for the company"}
- Company "Examplo". Article "Five startups to watch this year: Examplo, ..." → {"sentiment": "neutral", "reason": "Company only listed among others"}

${COMMON_RULES}`;

export const SENTIMENT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { sentiment: { type: 'string', enum: [...SENTIMENTS] }, reason: REASON_SCHEMA },
  required: ['sentiment', 'reason'],
  additionalProperties: false,
};

export function buildSentimentRequest(company: CompanyProfile, article: ClassifiableArticle): StructuredChatRequest {
  return {
    system: SENTIMENT_SYSTEM_PROMPT,
    user: `${describeCompany(company)}\n\nArticle:\n${describeArticle(article)}\n\nWhat is this article's sentiment toward this company?`,
    schema: SENTIMENT_SCHEMA,
  };
}

export function parseSentimentVerdict(value: unknown): SentimentVerdict | undefined {
  if (!isRecord(value) || !isSentiment(value.sentiment)) return undefined;
  const reason = readReason(value.reason);
  return reason === undefined ? undefined : { sentiment: value.sentiment, reason };
}
