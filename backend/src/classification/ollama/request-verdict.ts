import { ClassifierOutputInvalid } from '../classifier-errors';
import type { StructuredChat, StructuredChatRequest } from './structured-chat';

/** Reads a verdict from parsed JSON; `undefined` when the value is not a valid verdict. */
export type VerdictParser<T> = (value: unknown) => T | undefined;

/** How many times a malformed answer is asked again before giving up. */
export const MALFORMED_ANSWER_RETRIES = 1;

/**
 * Asks `chat` and validates the answer on our side — the schema-constrained
 * `format` is a strong hint, not a guarantee. A malformed answer is asked again
 * once, then fails with `ClassifierOutputInvalid` carrying a truncated excerpt.
 * `ClassifierUnavailable` from `chat` is not retried: the Run's failure
 * threshold decides what to do about an unreachable model.
 */
export async function requestVerdict<T>(
  chat: StructuredChat,
  request: StructuredChatRequest,
  parse: VerdictParser<T>,
): Promise<T> {
  let lastAnswer = '';
  for (let attempt = 0; attempt <= MALFORMED_ANSWER_RETRIES; attempt += 1) {
    lastAnswer = await chat.complete(request);
    const verdict = parse(parseJson(lastAnswer));
    if (verdict !== undefined) return verdict;
  }
  throw new ClassifierOutputInvalid(
    `The model answered with an unreadable verdict ${MALFORMED_ANSWER_RETRIES + 1} times`,
    lastAnswer,
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
