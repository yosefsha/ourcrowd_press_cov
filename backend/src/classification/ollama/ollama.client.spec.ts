import { ClassifierUnavailable } from '../classifier-errors';
import { type Fetch, OllamaClient, type OllamaClientOptions } from './ollama.client';
import type { StructuredChatRequest } from './structured-chat';

/*
 * Response bodies below follow the shapes documented for Ollama's REST API
 * (https://github.com/ollama/ollama/blob/main/docs/api.md): a non-streaming
 * `/api/chat` answer and a `/api/tags` listing. They exercise our parsing of
 * the protocol envelope only — they are not recorded model verdicts.
 */
function chatResponseBody(content: string): unknown {
  return {
    model: 'qwen2.5:7b',
    created_at: '2026-10-07T08:00:00.000000Z',
    message: { role: 'assistant', content },
    done_reason: 'stop',
    done: true,
  };
}

function tagsResponseBody(names: readonly string[]): unknown {
  return {
    models: names.map((name) => ({ name, model: name, modified_at: '2026-10-01T00:00:00Z', size: 4_683_087_332 })),
  };
}

const OPTIONS: OllamaClientOptions = {
  baseUrl: 'http://ollama.test:11434/',
  model: 'qwen2.5:7b',
  numParallel: 2,
  timeoutMs: 5_000,
};

const REQUEST: StructuredChatRequest = {
  system: 'system prompt',
  user: 'user message',
  schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
};

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
}

function fetchReturning(respond: (call: RecordedCall) => Promise<Response> | Response): { fetch: Fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const call = { url, init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as Fetch;
  return { fetch: fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('OllamaClient', () => {
  describe('complete', () => {
    it('posts a non-streaming /api/chat request with the schema as format and temperature 0', async () => {
      const { fetch, calls } = fetchReturning(() => jsonResponse(chatResponseBody('{"ok":true}')));

      await new OllamaClient(OPTIONS, fetch).complete(REQUEST);

      expect(calls).toHaveLength(1);
      const [call] = calls;
      expect(call?.url).toBe('http://ollama.test:11434/api/chat');
      expect(call?.init.method).toBe('POST');
      expect(call?.init.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.parse(call?.init.body as string)).toEqual({
        model: 'qwen2.5:7b',
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user message' },
        ],
        format: REQUEST.schema,
        stream: false,
        options: { temperature: 0 },
      });
    });

    it('returns the assistant message content as raw text', async () => {
      const { fetch } = fetchReturning(() => jsonResponse(chatResponseBody('{"ok":true}')));

      await expect(new OllamaClient(OPTIONS, fetch).complete(REQUEST)).resolves.toBe('{"ok":true}');
    });

    it('maps a refused connection to ClassifierUnavailable naming the server', async () => {
      const { fetch } = fetchReturning(() => {
        throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED 127.0.0.1:11434') });
      });

      const failure = new OllamaClient(OPTIONS, fetch).complete(REQUEST);

      await expect(failure).rejects.toBeInstanceOf(ClassifierUnavailable);
      await expect(failure).rejects.toThrow(
        'Ollama at http://ollama.test:11434 did not answer /api/chat: fetch failed (connect ECONNREFUSED 127.0.0.1:11434)',
      );
    });

    it('names the error code when the connection error has no message', async () => {
      const refused = Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });
      const { fetch } = fetchReturning(() => {
        throw new TypeError('fetch failed', { cause: refused });
      });

      await expect(new OllamaClient(OPTIONS, fetch).complete(REQUEST)).rejects.toThrow('fetch failed (ECONNREFUSED)');
    });

    it('maps a timeout to ClassifierUnavailable', async () => {
      const { fetch } = fetchReturning(
        ({ init }) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error));
          }),
      );

      const failure = new OllamaClient({ ...OPTIONS, timeoutMs: 20 }, fetch).complete(REQUEST);

      await expect(failure).rejects.toBeInstanceOf(ClassifierUnavailable);
      await expect(failure).rejects.toThrow('no answer within 20 ms');
    });

    it('maps a missing model (HTTP 404) to ClassifierUnavailable with the pull command', async () => {
      const { fetch } = fetchReturning(() =>
        jsonResponse({ error: 'model "qwen2.5:7b" not found, try pulling it first' }, 404),
      );

      await expect(new OllamaClient(OPTIONS, fetch).complete(REQUEST)).rejects.toThrow(
        'Ollama answered /api/chat with HTTP 404: model "qwen2.5:7b" not found, try pulling it first — run `ollama pull qwen2.5:7b`',
      );
    });

    it('maps a server error to ClassifierUnavailable with a truncated body', async () => {
      const { fetch } = fetchReturning(() => new Response('x'.repeat(5_000), { status: 500 }));

      const failure = new OllamaClient(OPTIONS, fetch).complete(REQUEST);

      await expect(failure).rejects.toBeInstanceOf(ClassifierUnavailable);
      const error = (await failure.catch((e: unknown) => e)) as Error;
      expect(error.message.length).toBeLessThan(300);
    });

    it('maps a body that is not JSON to ClassifierUnavailable', async () => {
      const { fetch } = fetchReturning(() => new Response('<html>proxy error</html>', { status: 200 }));

      await expect(new OllamaClient(OPTIONS, fetch).complete(REQUEST)).rejects.toThrow('the response was not JSON');
    });

    it('maps an answer without message content to ClassifierUnavailable', async () => {
      const { fetch } = fetchReturning(() => jsonResponse({ done: true }));

      await expect(new OllamaClient(OPTIONS, fetch).complete(REQUEST)).rejects.toThrow(
        'Ollama /api/chat answered without a message content',
      );
    });

    it('keeps at most numParallel requests in flight', async () => {
      let inFlight = 0;
      let peak = 0;
      const { fetch } = fetchReturning(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return jsonResponse(chatResponseBody('{"ok":true}'));
      });
      const client = new OllamaClient({ ...OPTIONS, numParallel: 2 }, fetch);

      await Promise.all(Array.from({ length: 6 }, () => client.complete(REQUEST)));

      expect(peak).toBe(2);
    });
  });

  describe('listModelNames', () => {
    it('gets /api/tags and returns the model names', async () => {
      const { fetch, calls } = fetchReturning(() => jsonResponse(tagsResponseBody(['qwen2.5:7b', 'llama3.2:latest'])));

      await expect(new OllamaClient(OPTIONS, fetch).listModelNames()).resolves.toEqual(['qwen2.5:7b', 'llama3.2:latest']);
      expect(calls[0]?.url).toBe('http://ollama.test:11434/api/tags');
      expect(calls[0]?.init.method).toBe('GET');
    });

    it('maps an answer without a model list to ClassifierUnavailable', async () => {
      const { fetch } = fetchReturning(() => jsonResponse({}));

      await expect(new OllamaClient(OPTIONS, fetch).listModelNames()).rejects.toBeInstanceOf(ClassifierUnavailable);
    });
  });
});
