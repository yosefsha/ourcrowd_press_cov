import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { AMBIGUITY_TRIAGE } from './ambiguity-triage';
import { CLASSIFIER_HEALTH } from './classifier-health';
import { ClassifierStartupGuard } from './classifier-startup-guard';
import { OllamaAmbiguityTriage } from './ollama/ollama-ambiguity.triage';
import { OllamaClassifierHealth } from './ollama/ollama-classifier-health';
import { OLLAMA_REQUEST_TIMEOUT_MS, OllamaClient } from './ollama/ollama.client';
import { OllamaRelevanceClassifier } from './ollama/ollama-relevance.classifier';
import { OllamaSentimentClassifier } from './ollama/ollama-sentiment.classifier';
import { RELEVANCE_CLASSIFIER } from './relevance-classifier';
import { SENTIMENT_CLASSIFIER } from './sentiment-classifier';

/**
 * The `RelevanceClassifier`, `SentimentClassifier`, `AmbiguityTriage` and
 * `ClassifierHealth` bindings on the local Ollama model (ADR-002, ADR-007).
 * Collector only: importing this module makes boot fail unless Ollama is
 * reachable with `OLLAMA_MODEL` pulled. Tests override `CLASSIFIER_HEALTH`
 * (and the classifier tokens) with in-memory implementations.
 */
@Module({
  providers: [
    {
      provide: OllamaClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): OllamaClient => {
        const ollama = config.get('ollama', { infer: true });
        return new OllamaClient({
          baseUrl: ollama.baseUrl,
          model: ollama.model,
          numParallel: ollama.numParallel,
          timeoutMs: OLLAMA_REQUEST_TIMEOUT_MS,
        });
      },
    },
    { provide: RELEVANCE_CLASSIFIER, useClass: OllamaRelevanceClassifier },
    { provide: SENTIMENT_CLASSIFIER, useClass: OllamaSentimentClassifier },
    { provide: AMBIGUITY_TRIAGE, useClass: OllamaAmbiguityTriage },
    { provide: CLASSIFIER_HEALTH, useClass: OllamaClassifierHealth },
    ClassifierStartupGuard,
  ],
  exports: [RELEVANCE_CLASSIFIER, SENTIMENT_CLASSIFIER, AMBIGUITY_TRIAGE, CLASSIFIER_HEALTH],
})
export class ClassificationModule {}
