import { Module } from '@nestjs/common';

import { FetchGoogleNewsTransport } from './google-news/fetch-google-news.transport';
import { GOOGLE_NEWS_TRANSPORT } from './google-news/google-news-transport';
import { RequestThrottle } from './google-news/request-throttle';
import { NEWS_SOURCE } from './news-source';
import { PUBLISHER_URL_RESOLVER } from './publisher-url-resolver';
import { GoogleNewsPublisherUrlResolver } from './repositories/google-news.publisher-url-resolver';
import { GoogleNewsRssNewsSource } from './repositories/google-news-rss.news-source';

/**
 * Minimum spacing between any two requests to news.google.com from this
 * process — searches and publisher URL resolution alike.
 */
const GOOGLE_NEWS_MIN_REQUEST_INTERVAL_MS = 300;

/**
 * The `NewsSource` binding (Google News RSS, ADR-001). Collector only.
 * Exports `NEWS_SOURCE` for the pipeline.
 */
@Module({
  providers: [
    {
      provide: GOOGLE_NEWS_TRANSPORT,
      useFactory: (): FetchGoogleNewsTransport =>
        new FetchGoogleNewsTransport(new RequestThrottle(GOOGLE_NEWS_MIN_REQUEST_INTERVAL_MS)),
    },
    { provide: PUBLISHER_URL_RESOLVER, useClass: GoogleNewsPublisherUrlResolver },
    { provide: NEWS_SOURCE, useClass: GoogleNewsRssNewsSource },
  ],
  exports: [NEWS_SOURCE],
})
export class NewsModule {}
