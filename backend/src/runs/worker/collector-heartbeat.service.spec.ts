import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ClassifierHealth, ClassifierHealthStatus } from '../../classification/classifier-health';
import type { AppConfig } from '../../config/configuration';
import { InMemoryCollectorHeartbeatStore } from '../repositories/in-memory-collector-heartbeat.store';
import { CollectorActivity } from './collector-activity';
import { CLASSIFIER_HEALTH_UNBOUND, CollectorHeartbeatService } from './collector-heartbeat.service';

const config = new ConfigService<AppConfig, true>({ runs: { pollIntervalMs: 1000 }, ollama: { model: 'qwen2.5:7b' } });
const at = new Date('2026-10-07T07:00:00Z');

function probe(result: ClassifierHealthStatus | Error): ClassifierHealth {
  return { check: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)) };
}

describe('CollectorHeartbeatService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('records the state and a healthy model', async () => {
    const store = new InMemoryCollectorHeartbeatStore();
    const activity = new CollectorActivity();
    activity.set('running');

    await new CollectorHeartbeatService(store, activity, config, probe({ ok: true, model: 'qwen2.5:7b' })).beat(() => at);

    await expect(store.latest()).resolves.toEqual({
      lastSeenAt: at,
      state: 'running',
      ollamaOk: true,
      ollamaModel: 'qwen2.5:7b',
      detail: null,
    });
  });

  it('records an unhealthy model with its detail', async () => {
    const store = new InMemoryCollectorHeartbeatStore();
    const health = probe({ ok: false, model: 'qwen2.5:7b', detail: 'model qwen2.5:7b is not pulled' });

    await new CollectorHeartbeatService(store, new CollectorActivity(), config, health).beat(() => at);

    await expect(store.latest()).resolves.toMatchObject({
      state: 'idle',
      ollamaOk: false,
      detail: 'model qwen2.5:7b is not pulled',
    });
  });

  it('reports the model as down when the check throws', async () => {
    const store = new InMemoryCollectorHeartbeatStore();

    await new CollectorHeartbeatService(store, new CollectorActivity(), config, probe(new Error('ECONNREFUSED'))).beat(() => at);

    await expect(store.latest()).resolves.toMatchObject({ ollamaOk: false, ollamaModel: 'qwen2.5:7b', detail: 'ECONNREFUSED' });
  });

  it('reports the model health as unknown when no check is bound', async () => {
    const store = new InMemoryCollectorHeartbeatStore();

    await new CollectorHeartbeatService(store, new CollectorActivity(), config, null).beat(() => at);

    await expect(store.latest()).resolves.toMatchObject({ ollamaOk: null, detail: CLASSIFIER_HEALTH_UNBOUND });
  });

  it('survives a failing store', async () => {
    const store = new InMemoryCollectorHeartbeatStore();
    jest.spyOn(store, 'record').mockRejectedValue(new Error('connection refused'));

    await expect(new CollectorHeartbeatService(store, new CollectorActivity(), config, null).beat()).resolves.toBeUndefined();
  });

  it('beats on bootstrap and then every poll interval until shutdown', async () => {
    jest.useFakeTimers();
    try {
      const store = new InMemoryCollectorHeartbeatStore();
      const record = jest.spyOn(store, 'record');
      const service = new CollectorHeartbeatService(store, new CollectorActivity(), config, null);

      await service.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(2_500);
      service.onApplicationShutdown();
      await jest.advanceTimersByTimeAsync(5_000);

      expect(record).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });
});
