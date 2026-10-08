import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppConfigModule } from '../config/app-config.module';
import { AMBIGUITY_TRIAGE, type AmbiguityTriage } from './ambiguity-triage';
import { ClassificationModule } from './classification.module';
import { ClassifierUnavailable } from './classifier-errors';
import { CLASSIFIER_HEALTH, type ClassifierHealth } from './classifier-health';
import { OllamaAmbiguityTriage } from './ollama/ollama-ambiguity.triage';
import { OllamaClassifierHealth } from './ollama/ollama-classifier-health';
import { OllamaRelevanceClassifier } from './ollama/ollama-relevance.classifier';
import { OllamaSentimentClassifier } from './ollama/ollama-sentiment.classifier';
import { RELEVANCE_CLASSIFIER, type RelevanceClassifier } from './relevance-classifier';
import { SENTIMENT_CLASSIFIER, type SentimentClassifier } from './sentiment-classifier';

/** A module outside ClassificationModule, injecting every exported token as #7/#8/#9 will. */
@Injectable()
class Consumer {
  constructor(
    @Inject(RELEVANCE_CLASSIFIER) readonly relevance: RelevanceClassifier,
    @Inject(SENTIMENT_CLASSIFIER) readonly sentiment: SentimentClassifier,
    @Inject(AMBIGUITY_TRIAGE) readonly triage: AmbiguityTriage,
    @Inject(CLASSIFIER_HEALTH) readonly health: ClassifierHealth,
  ) {}
}

@Module({ imports: [ClassificationModule], providers: [Consumer] })
class ConsumerModule {}

const READY: ClassifierHealth = { check: () => Promise.resolve({ ok: true, model: 'qwen2.5:7b' }) };

describe('ClassificationModule', () => {
  it('exports the Ollama classifiers and health probe to importing modules', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppConfigModule, ConsumerModule] })
      .overrideProvider(CLASSIFIER_HEALTH)
      .useValue(READY)
      .compile();
    await moduleRef.init();

    const consumer = moduleRef.get(Consumer);
    expect(consumer.relevance).toBeInstanceOf(OllamaRelevanceClassifier);
    expect(consumer.sentiment).toBeInstanceOf(OllamaSentimentClassifier);
    expect(consumer.triage).toBeInstanceOf(OllamaAmbiguityTriage);
    expect(consumer.health).toBe(READY);
    await moduleRef.close();
  });

  it('binds the Ollama health probe by default', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppConfigModule, ConsumerModule] }).compile();

    expect(moduleRef.get(Consumer).health).toBeInstanceOf(OllamaClassifierHealth);
  });

  it('fails initialisation when the model is not ready', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppConfigModule, ConsumerModule] })
      .overrideProvider(CLASSIFIER_HEALTH)
      .useValue({ check: () => Promise.resolve({ ok: false, model: 'qwen2.5:7b', detail: 'Run `ollama pull qwen2.5:7b`.' }) })
      .setLogger({ log: () => undefined, error: () => undefined, warn: () => undefined })
      .compile();

    await expect(moduleRef.init()).rejects.toBeInstanceOf(ClassifierUnavailable);
  });
});
