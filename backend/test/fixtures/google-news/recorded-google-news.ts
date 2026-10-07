import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import type { CompanyProfile } from '../../../src/domain/company';
import type { DateRange } from '../../../src/domain/date-range';
import type { NewsEdition } from '../../../src/domain/news-edition';
import { parseNewsEdition } from '../../../src/domain/news-edition';
import type {
  GoogleNewsRequest,
  GoogleNewsTransport,
} from '../../../src/news/google-news/google-news-transport';
import { GoogleNewsRequestFailed } from '../../../src/news/google-news/google-news-transport';
import {
  buildArticlePageUrl,
  buildDecodeEndpointUrl,
} from '../../../src/news/google-news/google-news-urls';
import type { NewsSource } from '../../../src/news/news-source';
import { GoogleNewsPublisherUrlResolver } from '../../../src/news/repositories/google-news.publisher-url-resolver';
import { GoogleNewsRssNewsSource } from '../../../src/news/repositories/google-news-rss.news-source';

/**
 * Real Google News responses recorded by `npm run fixtures:google-news`
 * (ADR-006). `manifest.json` lists what each file answers.
 */
const FIXTURES_DIR = __dirname;

interface ManifestFeed {
  readonly file: string;
  readonly description: string;
  readonly edition: string;
  readonly profile: CompanyProfile;
  readonly window: { readonly from: string; readonly to: string };
  readonly url: string;
}

interface ManifestPublisherUrl {
  readonly feedFile: string;
  readonly edition: string;
  readonly googleArticleId: string;
  readonly pageFile: string;
  readonly decodeResponseFile: string;
  readonly resolvedUrl: string;
}

interface Manifest {
  readonly recordedAt: string;
  readonly feeds: readonly ManifestFeed[];
  readonly publisherUrl: ManifestPublisherUrl;
}

/** One recorded search: the inputs it was made for and the URL it was made to. */
export interface RecordedFeed {
  readonly file: string;
  readonly edition: NewsEdition;
  readonly profile: CompanyProfile;
  readonly window: DateRange;
  readonly url: string;
  readonly xml: string;
}

/** The recorded resolution of one article's publisher URL. */
export interface RecordedPublisherUrl {
  readonly edition: NewsEdition;
  readonly googleArticleId: string;
  readonly articlePage: string;
  readonly decodeResponse: string;
  readonly resolvedUrl: string;
}

function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'manifest.json'), 'utf8')) as Manifest;
}

/** Every recorded search feed. */
export function recordedFeeds(): readonly RecordedFeed[] {
  return readManifest().feeds.map((feed) => ({
    file: feed.file,
    edition: parseNewsEdition(feed.edition),
    profile: feed.profile,
    window: { from: new Date(feed.window.from), to: new Date(feed.window.to) },
    url: feed.url,
    xml: readFileSync(join(FIXTURES_DIR, feed.file), 'utf8'),
  }));
}

/** The recorded feed stored in `file`, e.g. `harvey.en-US.xml`. */
export function recordedFeed(file: string): RecordedFeed {
  const feed = recordedFeeds().find((candidate) => candidate.file === file);
  if (feed === undefined) {
    throw new Error(`No recorded feed ${file}`);
  }
  return feed;
}

/** The recorded article page and decode response for one article. */
export function recordedPublisherUrl(): RecordedPublisherUrl {
  const recorded = readManifest().publisherUrl;
  return {
    edition: parseNewsEdition(recorded.edition),
    googleArticleId: recorded.googleArticleId,
    articlePage: gunzipSync(readFileSync(join(FIXTURES_DIR, recorded.pageFile))).toString('utf8'),
    decodeResponse: readFileSync(join(FIXTURES_DIR, recorded.decodeResponseFile), 'utf8'),
    resolvedUrl: recorded.resolvedUrl,
  };
}

/**
 * Replays recorded responses for the requests they were recorded for; any
 * other request fails like an unreachable host. Records every request it sees.
 */
export class RecordedGoogleNewsTransport implements GoogleNewsTransport {
  readonly requests: GoogleNewsRequest[] = [];
  private readonly responses = new Map<string, string>();
  private readonly decodeResponses = new Map<string, string>();

  constructor() {
    for (const feed of recordedFeeds()) {
      this.responses.set(feed.url, feed.xml);
    }
    const publisher = recordedPublisherUrl();
    this.responses.set(
      buildArticlePageUrl(publisher.googleArticleId, publisher.edition).href,
      publisher.articlePage,
    );
    this.decodeResponses.set(publisher.googleArticleId, publisher.decodeResponse);
  }

  fetchText(request: GoogleNewsRequest): Promise<string> {
    this.requests.push(request);
    const decodeEndpoint = buildDecodeEndpointUrl().href;
    const response =
      request.url.href === decodeEndpoint && request.form !== undefined
        ? this.decodeResponseFor(request.form)
        : this.responses.get(request.url.href);
    if (response === undefined) {
      return Promise.reject(new GoogleNewsRequestFailed(`Nothing recorded for ${request.url.href}`, 404));
    }
    return Promise.resolve(response);
  }

  private decodeResponseFor(form: URLSearchParams): string | undefined {
    const body = form.get('f.req') ?? '';
    for (const [googleArticleId, response] of this.decodeResponses) {
      if (body.includes(googleArticleId)) {
        return response;
      }
    }
    return undefined;
  }
}

/**
 * The in-memory `NewsSource` for tests: the real Google News implementation
 * answering from recorded responses. A search returns recorded articles only
 * for a company profile, window and edition listed in `manifest.json` (e.g.
 * Stripe, Harvey or Siteaware for Q3 2026); anything else is
 * `NewsSourceUnavailable`, as an unreachable feed would be.
 */
export function recordedNewsSource(
  transport: GoogleNewsTransport = new RecordedGoogleNewsTransport(),
): NewsSource {
  return new GoogleNewsRssNewsSource(transport, new GoogleNewsPublisherUrlResolver(transport));
}
