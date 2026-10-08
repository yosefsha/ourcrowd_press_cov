import { Inject, Injectable } from '@nestjs/common';

import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { SentimentVerdict } from '../../domain/sentiment';
import { buildSentimentRequest, parseSentimentVerdict } from '../prompts/sentiment.prompt';
import type { SentimentClassifier } from '../sentiment-classifier';
import { OllamaClient } from './ollama.client';
import { requestVerdict } from './request-verdict';
import type { StructuredChat } from './structured-chat';

/** `SentimentClassifier` on the local Ollama model, using the `sentiment-v1` prompt. */
@Injectable()
export class OllamaSentimentClassifier implements SentimentClassifier {
  constructor(@Inject(OllamaClient) private readonly chat: StructuredChat) {}

  classify(company: CompanyProfile, article: ClassifiableArticle): Promise<SentimentVerdict> {
    return requestVerdict(this.chat, buildSentimentRequest(company, article), parseSentimentVerdict);
  }
}
