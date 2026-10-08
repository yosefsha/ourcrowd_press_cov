import { Injectable } from '@nestjs/common';

/** Injection token for the `Clock` the executors read the current time from. */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

/** The wall clock. */
@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
