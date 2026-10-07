import type { Run } from './types.ts';

/** The API answered with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;
  /** The decoded response body, or null when it was empty or not JSON. */
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  /** A 4xx: the request itself was wrong, so repeating it cannot succeed. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

/** 409 from an enqueue endpoint: another Run is already queued or running. */
export class RunConflictError extends ApiError {
  readonly activeRun: Run;

  constructor(message: string, body: unknown, activeRun: Run) {
    super(409, message, body);
    this.name = 'RunConflictError';
    this.activeRun = activeRun;
  }
}

/** The request never produced an HTTP response (offline, DNS, connection refused, aborted). */
export class NetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

/** The API answered 2xx with a body that is not the JSON the contract promises. */
export class InvalidResponseError extends Error {
  readonly status: number;

  constructor(status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidResponseError';
    this.status = status;
  }
}
