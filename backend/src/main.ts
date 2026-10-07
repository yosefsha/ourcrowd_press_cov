import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { ApiModule } from './api.module';
import type { AppConfig } from './config/configuration';
import { configureApiApp } from './configure-api-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(ApiModule);
  configureApiApp(app);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  await app.listen(config.get('port', { infer: true }));
}

void bootstrap();
