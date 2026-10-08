import { GOOGLE_NEWS_HOST } from './google-news-urls';
import type { GoogleNewsRequest, GoogleNewsTransport } from './google-news-transport';
import { GoogleNewsRequestFailed } from './google-news-transport';
import type { RequestThrottle } from './request-throttle';

/** The fetch function the transport sends requests with (the global `fetch` in production). */
export type FetchFunction = (input: URL, init: RequestInit) => Promise<Response>;

/**
 * `GoogleNewsTransport` over the platform `fetch`. Guards every request:
 * - only `https://news.google.com` — any other URL is refused before sending,
 *   and redirects are not followed, so nothing can bounce a request elsewhere;
 * - a timeout covering the whole exchange, body included;
 * - a cap on the decoded body size, checked while streaming;
 * - a shared throttle spacing requests to the host.
 */
export class FetchGoogleNewsTransport implements GoogleNewsTransport {
  constructor(
    private readonly throttle: RequestThrottle,
    private readonly fetchFn: FetchFunction = (input, init) => fetch(input, init),
  ) {}

  async fetchText(request: GoogleNewsRequest): Promise<string> {
    const { url } = request;
    if (url.protocol !== 'https:' || url.hostname !== GOOGLE_NEWS_HOST || url.port !== '') {
      throw new GoogleNewsRequestFailed(`Refusing to request a host other than ${GOOGLE_NEWS_HOST}`);
    }
    await this.throttle.acquire();
    const signal = AbortSignal.timeout(request.timeoutMs);
    try {
      const response = await this.fetchFn(url, {
        method: request.form === undefined ? 'GET' : 'POST',
        body: request.form?.toString(),
        headers: {
          Accept: request.form === undefined ? 'application/rss+xml, text/html;q=0.9' : '*/*',
          ...(request.form === undefined
            ? {}
            : { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }),
        },
        redirect: 'manual',
        signal,
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new GoogleNewsRequestFailed(
          `Google News answered HTTP ${response.status}`,
          response.status,
        );
      }
      return await readLimited(response, request);
    } catch (error: unknown) {
      if (error instanceof GoogleNewsRequestFailed) {
        throw error;
      }
      const reason = signal.aborted ? `timed out after ${request.timeoutMs} ms` : 'failed';
      throw new GoogleNewsRequestFailed(`Request to Google News ${reason}`, null, { cause: error });
    }
  }
}

async function readLimited(response: Response, request: GoogleNewsRequest): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > request.maxBytes) {
    await response.body?.cancel();
    throw tooLarge(request.maxBytes);
  }
  if (response.body === null) {
    return '';
  }
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder('utf-8');
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    received += value.byteLength;
    if (received > request.maxBytes) {
      await reader.cancel();
      throw tooLarge(request.maxBytes);
    }
    text += decoder.decode(value, { stream: true });
    if (request.stopWhen?.(text) === true) {
      await reader.cancel();
      return text;
    }
  }
}

function tooLarge(maxBytes: number): GoogleNewsRequestFailed {
  return new GoogleNewsRequestFailed(`Google News response exceeded ${maxBytes} bytes`);
}
