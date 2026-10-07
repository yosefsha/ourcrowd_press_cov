import { NestFactory } from '@nestjs/core';

import { CollectorModule } from './collector.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(CollectorModule);
  // SIGTERM / SIGINT close the context: shutdown hooks run, the keep-alive
  // handle is released and the database pool drains before the process exits.
  app.enableShutdownHooks();
}

void bootstrap();
