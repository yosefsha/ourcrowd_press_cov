import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { NewsSource } from './news-source';
import { NEWS_SOURCE } from './news-source';
import { NewsModule } from './news.module';
import { GoogleNewsRssNewsSource } from './repositories/google-news-rss.news-source';

@Injectable()
class NewsConsumer {
  constructor(@Inject(NEWS_SOURCE) readonly newsSource: NewsSource) {}
}

@Module({ imports: [NewsModule], providers: [NewsConsumer] })
class ConsumerModule {}

describe('NewsModule', () => {
  it('exports NEWS_SOURCE, bound to Google News RSS, to modules that import it', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConsumerModule] }).compile();

    expect(moduleRef.get(NewsConsumer).newsSource).toBeInstanceOf(GoogleNewsRssNewsSource);
    await moduleRef.close();
  });
});
