import type { FetchFunction } from './fetch-google-news.transport';
import { FetchGoogleNewsTransport } from './fetch-google-news.transport';
import type { GoogleNewsRequest } from './google-news-transport';
import { GoogleNewsRequestFailed } from './google-news-transport';
import { RequestThrottle } from './request-throttle';

const FEED_URL = new URL('https://news.google.com/rss/search?q=%22Stripe%22&hl=en-US&gl=US&ceid=US%3Aen');

function request(overrides: Partial<GoogleNewsRequest> = {}): GoogleNewsRequest {
  return { url: FEED_URL, maxBytes: 1024, timeoutMs: 1000, ...overrides };
}

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller): void {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

interface FakeFetch {
  readonly fn: FetchFunction;
  readonly calls: { url: URL; init: RequestInit }[];
}

function fakeFetch(respond: (init: RequestInit) => Promise<Response>): FakeFetch {
  const calls: { url: URL; init: RequestInit }[] = [];
  return {
    calls,
    fn: (url, init) => {
      calls.push({ url, init });
      return respond(init);
    },
  };
}

function transport(fetch: FakeFetch): FetchGoogleNewsTransport {
  return new FetchGoogleNewsTransport(new RequestThrottle(0), fetch.fn);
}

describe('FetchGoogleNewsTransport', () => {
  it('GETs the URL and returns the body, never following redirects', async () => {
    const fetch = fakeFetch(() => Promise.resolve(new Response(streamOf(['<rss>', '</rss>']))));

    await expect(transport(fetch).fetchText(request())).resolves.toBe('<rss></rss>');
    expect(fetch.calls[0]?.url).toBe(FEED_URL);
    expect(fetch.calls[0]?.init).toMatchObject({ method: 'GET', redirect: 'manual' });
  });

  it('POSTs a form body as urlencoded', async () => {
    const fetch = fakeFetch(() => Promise.resolve(new Response('ok')));
    const url = new URL('https://news.google.com/_/DotsSplashUi/data/batchexecute');

    await transport(fetch).fetchText(request({ url, form: new URLSearchParams({ 'f.req': '[1]' }) }));

    expect(fetch.calls[0]?.init).toMatchObject({ method: 'POST', body: 'f.req=%5B1%5D' });
  });

  it.each([
    ['another host', 'https://evil.example/rss/search'],
    ['a look-alike host', 'https://news.google.com.evil.example/rss/search'],
    ['plain http', 'http://news.google.com/rss/search'],
    ['another port', 'https://news.google.com:8443/rss/search'],
    ['a metadata address', 'http://169.254.169.254/latest/meta-data'],
  ])('refuses %s without sending anything', async (_case, url) => {
    const fetch = fakeFetch(() => Promise.resolve(new Response('')));

    await expect(transport(fetch).fetchText(request({ url: new URL(url) }))).rejects.toThrow(
      GoogleNewsRequestFailed,
    );
    expect(fetch.calls).toHaveLength(0);
  });

  it.each([302, 429, 503])('fails on HTTP %i with the status', async (status) => {
    const fetch = fakeFetch(() =>
      Promise.resolve(new Response(null, { status, headers: { location: 'https://evil.example/' } })),
    );

    await expect(transport(fetch).fetchText(request())).rejects.toMatchObject({
      name: 'GoogleNewsRequestFailed',
      status,
    });
  });

  it('rejects a body declared larger than the limit before reading it', async () => {
    const fetch = fakeFetch(() =>
      Promise.resolve(new Response('x', { headers: { 'content-length': '5000' } })),
    );

    await expect(transport(fetch).fetchText(request())).rejects.toThrow(/exceeded 1024 bytes/);
  });

  it('rejects a body that grows past the limit while streaming', async () => {
    const fetch = fakeFetch(() => Promise.resolve(new Response(streamOf(['a'.repeat(600), 'b'.repeat(600)]))));

    await expect(transport(fetch).fetchText(request())).rejects.toThrow(/exceeded 1024 bytes/);
  });

  it('stops reading once the caller has what it needs', async () => {
    const fetch = fakeFetch(() =>
      Promise.resolve(new Response(streamOf(['head ', 'sg="x" ', 'a'.repeat(5000)]))),
    );

    await expect(
      transport(fetch).fetchText(request({ stopWhen: (text) => text.includes('sg="x"') })),
    ).resolves.toBe('head sg="x" ');
  });

  it('times out a request that does not answer', async () => {
    const fetch = fakeFetch(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );

    await expect(transport(fetch).fetchText(request({ timeoutMs: 20 }))).rejects.toThrow(
      /timed out after 20 ms/,
    );
  });

  it('wraps a network error, keeping it as the cause', async () => {
    const cause = new TypeError('fetch failed');
    const fetch = fakeFetch(() => Promise.reject(cause));

    await expect(transport(fetch).fetchText(request())).rejects.toMatchObject({
      name: 'GoogleNewsRequestFailed',
      cause,
    });
  });

  it('waits for the throttle before each request', async () => {
    const order: string[] = [];
    const throttle = new RequestThrottle(0);
    jest.spyOn(throttle, 'acquire').mockImplementation(() => {
      order.push('throttle');
      return Promise.resolve();
    });
    const fetch = fakeFetch(() => {
      order.push('fetch');
      return Promise.resolve(new Response('ok'));
    });

    await new FetchGoogleNewsTransport(throttle, fetch.fn).fetchText(request());

    expect(order).toEqual(['throttle', 'fetch']);
  });
});
