import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import type { CollectorHeartbeat } from './collector-heartbeat';
import { CollectorHealthService } from './collector-health.service';
import { CollectorHealthDto } from './dto/collector-health.dto';
import { InMemoryCollectorHeartbeatStore } from './repositories/in-memory-collector-heartbeat.store';

const config = new ConfigService<AppConfig, true>({ runs: { pollIntervalMs: 3000 } });
const now = new Date('2026-10-07T07:00:00.000Z');

function heartbeatAgo(ms: number): CollectorHeartbeat {
  return {
    lastSeenAt: new Date(now.getTime() - ms),
    state: 'idle',
    ollamaOk: true,
    ollamaModel: 'qwen2.5:7b',
    detail: null,
  };
}

describe('CollectorHealthService', () => {
  it('is online while the heartbeat is within three poll intervals', async () => {
    const service = new CollectorHealthService(new InMemoryCollectorHeartbeatStore(heartbeatAgo(9_000)), config);

    await expect(service.health(now)).resolves.toMatchObject({ online: true });
  });

  it('is offline when the heartbeat is older than three poll intervals', async () => {
    const service = new CollectorHealthService(new InMemoryCollectorHeartbeatStore(heartbeatAgo(9_001)), config);

    const health = await service.health(now);

    expect(health.online).toBe(false);
    expect(CollectorHealthDto.from(health)).toEqual({
      online: false,
      lastSeenAt: '2026-10-07T06:59:50.999Z',
      state: 'idle',
      ollamaOk: true,
      ollamaModel: 'qwen2.5:7b',
      detail: null,
    });
  });

  it('is offline with nulls when the collector has never reported', async () => {
    const service = new CollectorHealthService(new InMemoryCollectorHeartbeatStore(), config);

    expect(CollectorHealthDto.from(await service.health(now))).toEqual({
      online: false,
      lastSeenAt: null,
      state: null,
      ollamaOk: null,
      ollamaModel: null,
      detail: null,
    });
  });
});
