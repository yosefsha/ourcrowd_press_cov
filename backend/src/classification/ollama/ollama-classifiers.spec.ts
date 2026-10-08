import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import { ClassifierOutputInvalid } from '../classifier-errors';
import { AMBIGUITY_SCHEMA, AMBIGUITY_SYSTEM_PROMPT } from '../prompts/ambiguity.prompt';
import { RELEVANCE_SCHEMA, RELEVANCE_SYSTEM_PROMPT } from '../prompts/relevance.prompt';
import { SENTIMENT_SCHEMA, SENTIMENT_SYSTEM_PROMPT } from '../prompts/sentiment.prompt';
import { OllamaAmbiguityTriage } from './ollama-ambiguity.triage';
import { OllamaRelevanceClassifier } from './ollama-relevance.classifier';
import { OllamaSentimentClassifier } from './ollama-sentiment.classifier';
import type { StructuredChat, StructuredChatRequest } from './structured-chat';

const COMPANY: CompanyProfile = {
  displayName: 'Harvey',
  aliases: [],
  domain: 'harvey.ai',
  description: 'AI platform for law firms',
  searchTerms: ['Harvey AI'],
};

const ARTICLE: ClassifiableArticle = {
  title: 'Article title',
  snippet: 'Article snippet',
  outletName: 'Outlet',
  publishedAt: new Date('2026-09-01T10:00:00Z'),
  language: 'en',
};

/** Records the requests and answers with fixed raw texts (protocol-level test inputs, not verdicts). */
function chatAnswering(...answers: string[]): StructuredChat & { requests: StructuredChatRequest[] } {
  const requests: StructuredChatRequest[] = [];
  return {
    requests,
    complete(request: StructuredChatRequest): Promise<string> {
      requests.push(request);
      return Promise.resolve(answers[requests.length - 1] ?? '');
    },
  };
}

describe('OllamaRelevanceClassifier', () => {
  it('asks with the relevance prompt and schema and returns the verdict', async () => {
    const chat = chatAnswering('{"relevant":false,"reason":" About a storm "}');

    await expect(new OllamaRelevanceClassifier(chat).judge(COMPANY, ARTICLE)).resolves.toEqual({
      relevant: false,
      reason: 'About a storm',
    });
    expect(chat.requests[0]?.system).toBe(RELEVANCE_SYSTEM_PROMPT);
    expect(chat.requests[0]?.schema).toBe(RELEVANCE_SCHEMA);
    expect(chat.requests[0]?.user).toContain('Company: Harvey');
  });

  it('fails with ClassifierOutputInvalid after two unreadable answers', async () => {
    const chat = chatAnswering('{"relevant":"maybe","reason":"x"}', '{"reason":"x"}');

    await expect(new OllamaRelevanceClassifier(chat).judge(COMPANY, ARTICLE)).rejects.toBeInstanceOf(
      ClassifierOutputInvalid,
    );
  });
});

describe('OllamaSentimentClassifier', () => {
  it('asks with the sentiment prompt and schema and returns the verdict', async () => {
    const chat = chatAnswering('{"sentiment":"negative","reason":"Layoffs"}');

    await expect(new OllamaSentimentClassifier(chat).classify(COMPANY, ARTICLE)).resolves.toEqual({
      sentiment: 'negative',
      reason: 'Layoffs',
    });
    expect(chat.requests[0]?.system).toBe(SENTIMENT_SYSTEM_PROMPT);
    expect(chat.requests[0]?.schema).toBe(SENTIMENT_SCHEMA);
  });

  it('retries a sentiment outside the allowed values', async () => {
    const chat = chatAnswering('{"sentiment":"mixed","reason":"x"}', '{"sentiment":"neutral","reason":"Quoted"}');

    await expect(new OllamaSentimentClassifier(chat).classify(COMPANY, ARTICLE)).resolves.toEqual({
      sentiment: 'neutral',
      reason: 'Quoted',
    });
  });
});

describe('OllamaAmbiguityTriage', () => {
  it('asks with the ambiguity prompt and schema and returns the assessment', async () => {
    const chat = chatAnswering('{"ambiguous":true,"reason":"Common first name"}');

    await expect(new OllamaAmbiguityTriage(chat).assess('Harvey')).resolves.toEqual({
      ambiguous: true,
      reason: 'Common first name',
    });
    expect(chat.requests[0]?.system).toBe(AMBIGUITY_SYSTEM_PROMPT);
    expect(chat.requests[0]?.schema).toBe(AMBIGUITY_SCHEMA);
    expect(chat.requests[0]?.user).toContain('Company name: Harvey');
  });
});
