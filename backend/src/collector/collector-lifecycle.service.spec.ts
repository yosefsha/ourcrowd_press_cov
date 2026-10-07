import { CollectorLifecycle } from './collector-lifecycle.service';

describe('CollectorLifecycle', () => {
  it('holds the process open from bootstrap until shutdown', () => {
    const lifecycle = new CollectorLifecycle();
    expect(lifecycle.isRunning).toBe(false);

    lifecycle.onApplicationBootstrap();
    expect(lifecycle.isRunning).toBe(true);

    lifecycle.onApplicationShutdown('SIGTERM');
    expect(lifecycle.isRunning).toBe(false);
  });

  it('shuts down cleanly even if it never started', () => {
    const lifecycle = new CollectorLifecycle();

    expect(() => lifecycle.onApplicationShutdown()).not.toThrow();
    expect(lifecycle.isRunning).toBe(false);
  });
});
