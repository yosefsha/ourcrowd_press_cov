import { ApiError, InvalidResponseError, NetworkError, RunConflictError } from './apiErrors.ts';
import { RUN_STATUS_LABELS, RUN_TYPE_LABELS } from './runs.ts';

/** A sentence a reader can act on for a failed request, never a stack trace or driver message. */
export function requestErrorMessage(error: Error): string {
  if (error instanceof RunConflictError) {
    const run = error.activeRun;
    return `Another Run is already in progress: ${RUN_TYPE_LABELS[run.type]} #${run.id} is ${RUN_STATUS_LABELS[run.status].toLowerCase()}. Wait for it to finish.`;
  }
  if (error instanceof NetworkError) return 'Cannot reach the server. Check that the API is running, then try again.';
  if (error instanceof InvalidResponseError) return 'The server sent a response the dashboard cannot read.';
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Try again.';
}
