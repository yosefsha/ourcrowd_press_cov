import {
  recordedPublisherUrl,
  RecordedGoogleNewsTransport,
} from '../../../test/fixtures/google-news/recorded-google-news';
import { parseNewsEdition } from '../../domain/news-edition';
import type { GoogleNewsRequest, GoogleNewsTransport } from '../google-news/google-news-transport';
import { GoogleNewsRequestFailed } from '../google-news/google-news-transport';
import {
  buildDecodeRequestForm,
  extractArticleSignature,
  GoogleNewsPublisherUrlResolver,
  parseDecodeResponse,
} from './google-news.publisher-url-resolver';

const recorded = recordedPublisherUrl();

/** A transport answering each request with the next scripted response (or failure). */
class ScriptedTransport implements GoogleNewsTransport {
  readonly requests: GoogleNewsRequest[] = [];
  constructor(private readonly responses: (string | Error)[]) {}

  fetchText(request: GoogleNewsRequest): Promise<string> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (next === undefined || next instanceof Error) {
      return Promise.reject(next ?? new GoogleNewsRequestFailed('no more responses'));
    }
    return Promise.resolve(next);
  }
}

/** The recorded decode response with its publisher URL swapped for `url`. */
function decodeResponseWith(url: string): string {
  return recorded.decodeResponse.replace(recorded.resolvedUrl, url);
}

describe('GoogleNewsPublisherUrlResolver over the recorded responses', () => {
  it('resolves the recorded article to its publisher URL', async () => {
    const transport = new RecordedGoogleNewsTransport();
    const resolver = new GoogleNewsPublisherUrlResolver(transport);

    await expect(
      resolver.resolvePublisherUrl(recorded.googleArticleId, recorded.edition),
    ).resolves.toBe(recorded.resolvedUrl);
    expect(transport.requests.map((request) => request.url.hostname)).toEqual([
      'news.google.com',
      'news.google.com',
    ]);
  });

  it('remembers a resolved URL instead of asking again', async () => {
    const transport = new RecordedGoogleNewsTransport();
    const resolver = new GoogleNewsPublisherUrlResolver(transport);

    await resolver.resolvePublisherUrl(recorded.googleArticleId, recorded.edition);
    await resolver.resolvePublisherUrl(recorded.googleArticleId, recorded.edition);

    expect(transport.requests).toHaveLength(2);
  });

  it('reads the signature from the recorded article page', () => {
    expect(extractArticleSignature(recorded.articlePage)).toEqual({
      timestamp: expect.any(Number) as number,
      signature: expect.stringMatching(/^[A-Za-z0-9_-]+$/) as string,
    });
  });

  it('reads the publisher URL from the recorded decode response', () => {
    expect(parseDecodeResponse(recorded.decodeResponse)).toBe(recorded.resolvedUrl);
  });

  it('sends the article ID, edition and signature in the decode request', () => {
    const form = buildDecodeRequestForm(recorded.googleArticleId, parseNewsEdition('he-IL'), {
      timestamp: 1791372690,
      signature: 'AbIaSL8U',
    });
    const [[[rpc, inner]]] = JSON.parse(form.get('f.req') ?? '') as [[[string, string]]];
    const body = JSON.parse(inner) as unknown[];

    expect(rpc).toBe('Fbv4je');
    expect(body[0]).toBe('garturlreq');
    expect(body.slice(2)).toEqual([recorded.googleArticleId, 1791372690, 'AbIaSL8U']);
    expect(JSON.stringify(body[1])).toContain('"IL:he"');
  });
});

describe('GoogleNewsPublisherUrlResolver failure modes', () => {
  const edition = parseNewsEdition('en-US');
  const page = recorded.articlePage;

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['a relative path', '/elsewhere'],
  ])('returns null when the decoded URL is %s', async (_case, url) => {
    const resolver = new GoogleNewsPublisherUrlResolver(new ScriptedTransport([page, decodeResponseWith(url)]));

    await expect(resolver.resolvePublisherUrl(recorded.googleArticleId, edition)).resolves.toBeNull();
  });

  it('returns null when the page carries no signature, without calling the decoder', async () => {
    const transport = new ScriptedTransport(['<html>consent wall</html>']);
    const resolver = new GoogleNewsPublisherUrlResolver(transport);

    await expect(resolver.resolvePublisherUrl(recorded.googleArticleId, edition)).resolves.toBeNull();
    expect(transport.requests).toHaveLength(1);
  });

  it('returns null when a request fails', async () => {
    const resolver = new GoogleNewsPublisherUrlResolver(
      new ScriptedTransport([page, new GoogleNewsRequestFailed('HTTP 429', 429)]),
    );

    await expect(resolver.resolvePublisherUrl(recorded.googleArticleId, edition)).resolves.toBeNull();
  });

  it.each([
    ['an empty body', ''],
    ['not JSON', ")]}'\n\nnot json"],
    ['an error envelope', `)]}'\n\n${JSON.stringify([['er', null, null, null, null, 400]])}`],
  ])('returns null for a decode response that is %s', async (_case, response) => {
    const resolver = new GoogleNewsPublisherUrlResolver(new ScriptedTransport([page, response]));

    await expect(resolver.resolvePublisherUrl(recorded.googleArticleId, edition)).resolves.toBeNull();
  });

  it('refuses anything that is not an article ID without sending a request', async () => {
    const transport = new ScriptedTransport([]);
    const resolver = new GoogleNewsPublisherUrlResolver(transport);

    await expect(resolver.resolvePublisherUrl('../../169.254.169.254', edition)).resolves.toBeNull();
    expect(transport.requests).toHaveLength(0);
  });

  it('does not remember failures', async () => {
    const transport = new ScriptedTransport([
      new GoogleNewsRequestFailed('down'),
      page,
      recorded.decodeResponse,
    ]);
    const resolver = new GoogleNewsPublisherUrlResolver(transport);

    await expect(resolver.resolvePublisherUrl(recorded.googleArticleId, edition)).resolves.toBeNull();
    await expect(resolver.resolvePublisherUrl(recorded.googleArticleId, edition)).resolves.toBe(
      recorded.resolvedUrl,
    );
  });
});
