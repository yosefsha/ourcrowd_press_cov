import { Inject, Injectable } from '@nestjs/common';

import type { ClassifiableArticle } from '../../domain/article';
import type { CompanyProfile } from '../../domain/company';
import type { RelevanceVerdict } from '../../domain/relevance';
import { buildRelevanceRequest, parseRelevanceVerdict } from '../prompts/relevance.prompt';
import type { RelevanceClassifier } from '../relevance-classifier';
import { OllamaClient } from './ollama.client';
import { requestVerdict } from './request-verdict';
import type { StructuredChat } from './structured-chat';

/** `RelevanceClassifier` on the local Ollama model, using the `relevance-v1` prompt. */
@Injectable()
export class OllamaRelevanceClassifier implements RelevanceClassifier {
  constructor(@Inject(OllamaClient) private readonly chat: StructuredChat) {}

  judge(company: CompanyProfile, article: ClassifiableArticle): Promise<RelevanceVerdict> {
    return requestVerdict(this.chat, buildRelevanceRequest(company, article), parseRelevanceVerdict);
  }
}
