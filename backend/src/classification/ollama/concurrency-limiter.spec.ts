import { ConcurrencyLimiter } from './concurrency-limiter';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('ConcurrencyLimiter', () => {
  it('rejects a limit that is not a positive integer', () => {
    expect(() => new ConcurrencyLimiter(0)).toThrow(RangeError);
    expect(() => new ConcurrencyLimiter(1.5)).toThrow(RangeError);
  });

  it('starts queued tasks in arrival order as slots free up', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const started: number[] = [];
    const gates = [deferred(), deferred(), deferred()];
    const runs = gates.map((gate, index) =>
      limiter.run(async () => {
        started.push(index);
        await gate.promise;
        return index;
      }),
    );

    await Promise.resolve();
    expect(started).toEqual([0]);
    gates[0]?.resolve();
    await runs[0];
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    gates[1]?.resolve();
    gates[2]?.resolve();

    await expect(Promise.all(runs)).resolves.toEqual([0, 1, 2]);
    expect(started).toEqual([0, 1, 2]);
  });

  it('frees the slot when a task fails', async () => {
    const limiter = new ConcurrencyLimiter(1);

    await expect(limiter.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(limiter.run(() => Promise.resolve('next'))).resolves.toBe('next');
  });
});
