import { Inject, Injectable, Logger } from '@nestjs/common';

import type { NewsEdition } from '../../domain/news-edition';
import {
  buildArticlePageUrl,
  buildDecodeEndpointUrl,
  editionParameters,
  GOOGLE_ARTICLE_ID_PATTERN,
} from '../google-news/google-news-urls';
import type { GoogleNewsTransport } from '../google-news/google-news-transport';
import { GOOGLE_NEWS_TRANSPORT } from '../google-news/google-news-transport';
import { toHttpUrl } from '../google-news/safe-url';
import type { PublisherUrlResolver } from '../publisher-url-resolver';

/** An article page is ~0.6 MB of HTML; anything far larger is not the page we expect. */
const ARTICLE_PAGE_MAX_BYTES = 3 * 1024 * 1024;
const DECODE_RESPONSE_MAX_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
/** Resolved URLs remembered per process, so an Article seen again costs no requests. */
const CACHE_SIZE = 10_000;

const TIMESTAMP_PATTERN = /data-n-a-ts="(\d{1,12})"/;
const SIGNATURE_PATTERN = /data-n-a-sg="([A-Za-z0-9_-]{1,512})"/;
const RPC_ID = 'Fbv4je';

/** The decode signature an article page carries. */
export interface ArticleSignature {
  readonly timestamp: number;
  readonly signature: string;
}

/** Reads the decode signature (`data-n-a-ts`, `data-n-a-sg`) from an article page. */
export function extractArticleSignature(page: string): ArticleSignature | null {
  const timestamp = TIMESTAMP_PATTERN.exec(page)?.[1];
  const signature = SIGNATURE_PATTERN.exec(page)?.[1];
  if (timestamp === undefined || signature === undefined) {
    return null;
  }
  return { timestamp: Number(timestamp), signature };
}

/** The form body of the decode request the Google News web app sends for one article. */
export function buildDecodeRequestForm(
  googleArticleId: string,
  edition: NewsEdition,
  { timestamp, signature }: ArticleSignature,
): URLSearchParams {
  const inner = JSON.stringify([
    'garturlreq',
    [
      ['X', 'X', ['X', 'X'], null, null, 1, 1, editionParameters(edition).ceid, null, 1, null, null, null, null, null, 0, 1],
      'X',
      'X',
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    googleArticleId,
    timestamp,
    signature,
  ]);
  return new URLSearchParams({ 'f.req': JSON.stringify([[[RPC_ID, inner, null, 'generic']]]) });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * The publisher URL in a decode response (`)]}'` followed by JSON envelopes,
 * one of which is `["wrb.fr","Fbv4je","[\"garturlres\",\"<url>\",1]",…]`),
 * or null when it carries none or the URL is not `http(s)`.
 */
export function parseDecodeResponse(responseText: string): string | null {
  for (const line of responseText.split('\n')) {
    const envelopes = parseJson(line.trim());
    if (!Array.isArray(envelopes)) {
      continue;
    }
    for (const envelope of envelopes as unknown[]) {
      if (!Array.isArray(envelope) || envelope[0] !== 'wrb.fr' || envelope[1] !== RPC_ID) {
        continue;
      }
      const payload: unknown = typeof envelope[2] === 'string' ? parseJson(envelope[2]) : undefined;
      if (Array.isArray(payload) && payload[0] === 'garturlres') {
        return toHttpUrl(payload[1]);
      }
    }
  }
  return null;
}

/**
 * Resolves Google News article IDs the way the Google News web app does: read
 * the decode signature from the article page, then post it to the app's
 * decode endpoint. Both requests go only to `news.google.com` (the URLs are
 * built from the article ID, never taken from the feed), so this never fetches
 * a feed-supplied URL. Undocumented and liable to break — every failure
 * yields null.
 */
@Injectable()
export class GoogleNewsPublisherUrlResolver implements PublisherUrlResolver {
  private readonly logger = new Logger(GoogleNewsPublisherUrlResolver.name);
  private readonly resolved = new Map<string, string>();

  constructor(@Inject(GOOGLE_NEWS_TRANSPORT) private readonly transport: GoogleNewsTransport) {}

  async resolvePublisherUrl(googleArticleId: string, edition: NewsEdition): Promise<string | null> {
    if (!GOOGLE_ARTICLE_ID_PATTERN.test(googleArticleId)) {
      return null;
    }
    const cached = this.resolved.get(googleArticleId);
    if (cached !== undefined) {
      return cached;
    }
    try {
      const url = await this.decode(googleArticleId, edition);
      if (url !== null) {
        this.remember(googleArticleId, url);
      }
      return url;
    } catch (error: unknown) {
      this.logger.debug(
        `Could not resolve the publisher URL of ${googleArticleId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async decode(googleArticleId: string, edition: NewsEdition): Promise<string | null> {
    const page = await this.transport.fetchText({
      url: buildArticlePageUrl(googleArticleId, edition),
      maxBytes: ARTICLE_PAGE_MAX_BYTES,
      timeoutMs: REQUEST_TIMEOUT_MS,
      stopWhen: (text) => SIGNATURE_PATTERN.test(text) && TIMESTAMP_PATTERN.test(text),
    });
    const signature = extractArticleSignature(page);
    if (signature === null) {
      return null;
    }
    const response = await this.transport.fetchText({
      url: buildDecodeEndpointUrl(),
      form: buildDecodeRequestForm(googleArticleId, edition, signature),
      maxBytes: DECODE_RESPONSE_MAX_BYTES,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    return parseDecodeResponse(response);
  }

  private remember(googleArticleId: string, url: string): void {
    if (this.resolved.size >= CACHE_SIZE) {
      const oldest = this.resolved.keys().next();
      if (oldest.done !== true) {
        this.resolved.delete(oldest.value);
      }
    }
    this.resolved.set(googleArticleId, url);
  }
}
