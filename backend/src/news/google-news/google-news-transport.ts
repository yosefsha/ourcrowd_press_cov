/** Injection token for the `GoogleNewsTransport` seam. */
export const GOOGLE_NEWS_TRANSPORT = Symbol('GOOGLE_NEWS_TRANSPORT');

/** One request to Google News. Every URL is built by `google-news-urls.ts`. */
export interface GoogleNewsRequest {
  readonly url: URL;
  /** A form body makes the request a POST; without one it is a GET. */
  readonly form?: URLSearchParams;
  /** The response is rejected once its decoded body exceeds this many bytes. */
  readonly maxBytes: number;
  readonly timeoutMs: number;
  /**
   * Stops reading as soon as the text received so far satisfies this, and
   * returns that text — for pages whose useful part is near the top.
   */
  readonly stopWhen?: (textSoFar: string) => boolean;
}

/**
 * How the Google News implementations talk to `news.google.com`. It exists so
 * the feed parsing and resolution logic run unchanged against recorded
 * responses in tests. Fails only with `GoogleNewsRequestFailed`.
 */
export interface GoogleNewsTransport {
  fetchText(request: GoogleNewsRequest): Promise<string>;
}

/** A request to Google News did not produce a usable response. */
export class GoogleNewsRequestFailed extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'GoogleNewsRequestFailed';
  }
}
