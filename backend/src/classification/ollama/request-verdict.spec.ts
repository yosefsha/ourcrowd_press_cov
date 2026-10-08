import { ClassifierOutputInvalid, ClassifierUnavailable, MAX_DIAGNOSTIC_OUTPUT_LENGTH } from '../classifier-errors';
import { requestVerdict, type VerdictParser } from './request-verdict';
import type { StructuredChat, StructuredChatRequest } from './structured-chat';

const REQUEST: StructuredChatRequest = { system: 's', user: 'u', schema: { type: 'object' } };

const parseOk: VerdictParser<{ ok: boolean }> = (value) =>
  typeof value === 'object' && value !== null && typeof (value as { ok?: unknown }).ok === 'boolean'
    ? { ok: (value as { ok: boolean }).ok }
    : undefined;

/** A chat answering with the listed raw texts in turn (malformed answers are synthetic test inputs). */
function chatAnswering(...answers: (string | Error)[]): StructuredChat & { calls: number } {
  const chat = {
    calls: 0,
    complete(): Promise<string> {
      const answer = answers[chat.calls];
      chat.calls += 1;
      if (answer === undefined) return Promise.reject(new Error('unexpected extra call'));
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  return chat;
}

describe('requestVerdict', () => {
  it('returns the parsed verdict of a valid answer after one call', async () => {
    const chat = chatAnswering('{"ok":true}');

    await expect(requestVerdict(chat, REQUEST, parseOk)).resolves.toEqual({ ok: true });
    expect(chat.calls).toBe(1);
  });

  it('asks again once after a malformed answer', async () => {
    const chat = chatAnswering('not json', '{"ok":false}');

    await expect(requestVerdict(chat, REQUEST, parseOk)).resolves.toEqual({ ok: false });
    expect(chat.calls).toBe(2);
  });

  it('retries an answer that is JSON but not a verdict', async () => {
    const chat = chatAnswering('{"ok":"yes"}', '{"ok":true}');

    await expect(requestVerdict(chat, REQUEST, parseOk)).resolves.toEqual({ ok: true });
  });

  it('fails with ClassifierOutputInvalid after two malformed answers, keeping a truncated excerpt', async () => {
    const long = `not json ${'x'.repeat(5_000)}`;
    const chat = chatAnswering('not json', long);

    const error = await requestVerdict(chat, REQUEST, parseOk).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClassifierOutputInvalid);
    expect((error as ClassifierOutputInvalid).output).toHaveLength(MAX_DIAGNOSTIC_OUTPUT_LENGTH);
    expect((error as ClassifierOutputInvalid).message).not.toContain('xxx');
    expect(chat.calls).toBe(2);
  });

  it('does not retry when the model is unavailable', async () => {
    const chat = chatAnswering(new ClassifierUnavailable('down'));

    await expect(requestVerdict(chat, REQUEST, parseOk)).rejects.toBeInstanceOf(ClassifierUnavailable);
    expect(chat.calls).toBe(1);
  });
});
