import { Module } from '@nestjs/common';

/**
 * The `RelevanceClassifier`, `SentimentClassifier` and `AmbiguityTriage`
 * bindings on the local Ollama model (ADR-002, ADR-007). Collector only.
 */
@Module({})
export class ClassificationModule {}
