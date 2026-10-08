import { Logger } from '@nestjs/common';

import { ClassifierUnavailable } from './classifier-errors';
import type { ClassifierHealth, ClassifierHealthStatus } from './classifier-health';
import { ClassifierStartupGuard } from './classifier-startup-guard';

function healthReporting(status: ClassifierHealthStatus): ClassifierHealth {
  return { check: () => Promise.resolve(status) };
}

describe('ClassifierStartupGuard', () => {
  let loggedError: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    loggedError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets the collector boot when the model is ready', async () => {
    await expect(
      new ClassifierStartupGuard(healthReporting({ ok: true, model: 'qwen2.5:7b' })).onModuleInit(),
    ).resolves.toBeUndefined();
  });

  it('refuses to boot with the actionable detail when the model is not ready', async () => {
    const guard = new ClassifierStartupGuard(
      healthReporting({ ok: false, model: 'qwen2.5:7b', detail: 'Run `ollama pull qwen2.5:7b`.' }),
    );

    const failure = guard.onModuleInit();

    await expect(failure).rejects.toBeInstanceOf(ClassifierUnavailable);
    await expect(failure).rejects.toThrow('The collector cannot start: Run `ollama pull qwen2.5:7b`.');
    expect(loggedError).toHaveBeenCalledWith('The collector cannot start: Run `ollama pull qwen2.5:7b`.');
  });
});
