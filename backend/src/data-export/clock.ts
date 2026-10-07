/** The current instant; injected so exports can be rendered at a fixed time in tests. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
