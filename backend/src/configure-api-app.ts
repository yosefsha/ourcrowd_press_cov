import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

export const API_PREFIX = 'api';

/**
 * Applies the HTTP-level setup shared by `main.ts` and the e2e specs, so tests
 * exercise the same pipes and routing as production.
 */
export function configureApiApp(app: NestExpressApplication): NestExpressApplication {
  // One proxy hop (the load balancer / frontend reverse proxy) sits in front of
  // the API; trust its X-Forwarded-* headers for client IP and protocol.
  app.set('trust proxy', 1);
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
