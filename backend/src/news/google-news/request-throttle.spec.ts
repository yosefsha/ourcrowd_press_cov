import { RequestThrottle } from './request-throttle';

describe('RequestThrottle', () => {
  function fakeClock(): { now: () => number; sleep: (ms: number) => Promise<void>; slept: number[] } {
    let time = 1_000;
    const slept: number[] = [];
    return {
      now: () => time,
      sleep: (ms) => {
        slept.push(ms);
        time += ms;
        return Promise.resolve();
      },
      slept,
    };
  }

  it('lets the first request through immediately and spaces the following ones', async () => {
    const clock = fakeClock();
    const throttle = new RequestThrottle(300, clock.now, clock.sleep);

    await throttle.acquire();
    await throttle.acquire();
    await throttle.acquire();

    expect(clock.slept).toEqual([300, 300]);
  });

  it('spaces concurrent callers too', async () => {
    let time = 0;
    const slept: number[] = [];
    const throttle = new RequestThrottle(
      250,
      () => time,
      (ms) => {
        slept.push(ms);
        return Promise.resolve();
      },
    );

    await Promise.all([throttle.acquire(), throttle.acquire(), throttle.acquire()]);
    time = 10_000;
    await throttle.acquire();

    expect(slept).toEqual([250, 500]);
  });

  it('rejects a negative interval', () => {
    expect(() => new RequestThrottle(-1)).toThrow(RangeError);
  });
});
