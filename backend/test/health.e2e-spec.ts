import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { ApiModule } from '../src/api.module';
import { configureApiApp } from '../src/configure-api-app';

describe('GET /health (ApiModule against Postgres)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiModule] }).compile();
    app = configureApiApp(moduleRef.createNestApplication<NestExpressApplication>());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): App {
    return app.getHttpServer();
  }

  it('returns 200 with status ok, outside the /api prefix', async () => {
    const response = await request(server()).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('is not served under the /api prefix', async () => {
    await request(server()).get('/api/health').expect(404);
  });

  it('serves other routes under /api only', async () => {
    await request(server()).get('/unknown').expect(404);
    await request(server()).get('/api/unknown').expect(404);
  });
});
