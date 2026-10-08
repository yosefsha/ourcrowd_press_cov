import { Inject, Injectable } from '@nestjs/common';

import type { AmbiguityAssessment, AmbiguityTriage } from '../ambiguity-triage';
import { buildAmbiguityRequest, parseAmbiguityAssessment } from '../prompts/ambiguity.prompt';
import { OllamaClient } from './ollama.client';
import { requestVerdict } from './request-verdict';
import type { StructuredChat } from './structured-chat';

/** `AmbiguityTriage` on the local Ollama model, using the `ambiguity-v1` prompt. */
@Injectable()
export class OllamaAmbiguityTriage implements AmbiguityTriage {
  constructor(@Inject(OllamaClient) private readonly chat: StructuredChat) {}

  assess(name: string): Promise<AmbiguityAssessment> {
    return requestVerdict(this.chat, buildAmbiguityRequest(name), parseAmbiguityAssessment);
  }
}
