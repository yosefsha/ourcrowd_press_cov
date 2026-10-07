import { ClassifierUnavailable, truncateForDiagnosis } from '../classifier-errors';
import { ConcurrencyLimiter } from './concurrency-limiter';
import type { StructuredChat, StructuredChatRequest } from './structured-chat';

/**
 * Longest wait for one Ollama answer, measured from when the request is sent
 * (queueing behind `numParallel` does not count). Generous enough for the
 * first call, which loads the 7B model into memory.
 */
export const OLLAMA_REQUEST_TIMEOUT_MS = 120_000;

/** Longest excerpt of an Ollama error body quoted in an error message. */
const MAX_ERROR_BODY_LENGTH = 200;

export interface OllamaClientOptions {
  /** e.g. `http://localhost:11434`. */
  readonly baseUrl: string;
  /** e.g. `qwen2.5:7b`. */
  readonly model: string;
  /** Requests in flight at once; match Ollama's own `OLLAMA_NUM_PARALLEL`. */
  readonly numParallel: number;
  readonly timeoutMs: number;
}

/** `fetch`, injectable so the request shape can be tested without a server. */
export type Fetch = typeof fetch;

/**
 * Talks to a local Ollama server (ADR-007): `POST /api/chat` with the answer
 * constrained to a JSON Schema (`format`), `temperature: 0` and no streaming,
 * and `GET /api/tags` to list the pulled models. Every transport failure — no
 * connection, timeout, an HTTP error, a body that is not Ollama's — becomes a
 * `ClassifierUnavailable`; the answer text itself is returned unvalidated.
 */
export class OllamaClient implements StructuredChat {
  private readonly limiter: ConcurrencyLimiter;
  private readonly baseUrl: string;

  constructor(
    private readonly options: OllamaClientOptions,
    private readonly fetchImpl: Fetch = fetch,
  ) {
    this.limiter = new ConcurrencyLimiter(options.numParallel);
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  get model(): string {
    return this.options.model;
  }

  get serverUrl(): string {
    return this.baseUrl;
  }

  async complete(request: StructuredChatRequest): Promise<string> {
    const body = {
      model: this.options.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      format: request.schema,
      stream: false,
      options: { temperature: 0 },
    };
    const payload = await this.limiter.run(() =>
      this.send('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    const content = readChatContent(payload);
    if (content === undefined) {
      throw new ClassifierUnavailable('Ollama /api/chat answered without a message content');
    }
    return content;
  }

  /** Names of the models pulled on the server, e.g. `qwen2.5:7b`. */
  async listModelNames(): Promise<string[]> {
    const payload = await this.send('/api/tags', { method: 'GET' });
    const names = readModelNames(payload);
    if (names === undefined) {
      throw new ClassifierUnavailable('Ollama /api/tags answered without a model list');
    }
    return names;
  }

  private async send(path: string, init: RequestInit): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await this.fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
      if (!response.ok) {
        throw new ClassifierUnavailable(await describeHttpError(path, response, this.options.model));
      }
      return (await response.json());
    } catch (error) {
      if (error instanceof ClassifierUnavailable) throw error;
      throw new ClassifierUnavailable(`Ollama at ${this.baseUrl} did not answer ${path}: ${describeTransportError(error, this.options.timeoutMs)}`, {
        cause: error,
      });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `message.content` of a non-streaming `/api/chat` response. */
function readChatContent(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.message)) return undefined;
  const content = payload.message.content;
  return typeof content === 'string' ? content : undefined;
}

/** `models[].name` of a `/api/tags` response. */
function readModelNames(payload: unknown): string[] | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.models)) return undefined;
  return payload.models.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.name === 'string' ? [entry.name] : [],
  );
}

async function describeHttpError(path: string, response: Response, model: string): Promise<string> {
  let detail = '';
  try {
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    detail = isRecord(parsed) && typeof parsed.error === 'string' ? parsed.error : text;
  } catch {
    detail = '';
  }
  const excerpt = truncateForDiagnosis(detail.trim(), MAX_ERROR_BODY_LENGTH);
  const hint = response.status === 404 ? ` — run \`ollama pull ${model}\`` : '';
  return `Ollama answered ${path} with HTTP ${response.status}${excerpt ? `: ${excerpt}` : ''}${hint}`;
}

function describeTransportError(error: unknown, timeoutMs: number): string {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return `no answer within ${timeoutMs} ms`;
  }
  if (error instanceof SyntaxError) return 'the response was not JSON';
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` (${error.cause.message})` : '';
    return `${error.message}${cause}`;
  }
  return String(error);
}
