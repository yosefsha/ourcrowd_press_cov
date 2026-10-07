import { NotFoundException } from '@nestjs/common';

import { RECORDED_ARTICLES } from '../../test/fixtures/alerts/recorded-google-news-articles';
import type { Sentiment } from '../domain/sentiment';
import type { StoredAlertMention } from './alert-digest.repository';
import { AlertsService } from './alerts.service';
import { InMemoryAlertDigestRepository } from './repositories/in-memory-alert-digest.repository';

let articleId = 100;
function stored(
  key: keyof typeof RECORDED_ARTICLES,
  candidateId: number,
  companyId: number,
  sentiment: Sentiment,
): StoredAlertMention {
  const { company, article } = RECORDED_ARTICLES[key];
  articleId += 1;
  return {
    candidateId,
    companyId,
    displayName: company,
    sentiment,
    article: {
      id: articleId,
      title: article.title,
      snippet: article.snippet,
      outletName: article.outletName,
      outletUrl: article.outletUrl,
      googleUrl: article.googleUrl,
      publisherUrl: article.publisherUrl,
      publishedAt: article.publishedAt,
      language: article.language,
      edition: article.edition,
    },
  };
}

const ACK_TIME = new Date('2026-10-07T09:00:00Z');

function setup(): { service: AlertsService } {
  const repository = new InMemoryAlertDigestRepository([
    {
      id: 1,
      runId: 10,
      createdAt: new Date('2026-10-06T04:00:00Z'),
      acknowledgedAt: new Date('2026-10-06T08:00:00Z'),
      mentions: [stored('oncohostAward', 1, 4, 'positive')],
    },
    {
      id: 2,
      runId: 11,
      createdAt: new Date('2026-10-07T04:00:00Z'),
      acknowledgedAt: null,
      mentions: [
        stored('morphisecAiTrust', 2, 5, 'positive'),
        stored('zutacoreBusinessWirePartnership', 3, 1, 'positive'),
        stored('zutacoreDcdPartnership', 4, 1, 'negative'),
      ],
    },
  ]);
  return { service: new AlertsService(repository, () => ACK_TIME) };
}

describe('AlertsService', () => {
  it('lists digests newest first, filtered by acknowledgement', async () => {
    const { service } = setup();

    expect((await service.list({})).map((d) => d.id)).toEqual([2, 1]);
    expect((await service.list({ acknowledged: false })).map((d) => d.id)).toEqual([2]);
    expect((await service.list({ acknowledged: true })).map((d) => d.id)).toEqual([1]);
  });

  it('returns a digest grouped by company, negative Mentions first', async () => {
    const { service } = setup();

    const detail = await service.get(2);

    expect(detail.summary).toMatchObject({ mentionCount: 3, companyCount: 2, negativeMentionCount: 1 });
    expect(detail.companies.map((g) => [g.displayName, g.mentions.map((m) => m.candidateId)])).toEqual([
      ['ZutaCore', [4, 3]],
      ['Morphisec', [2]],
    ]);
  });

  it('answers NotFoundException for an unknown digest', async () => {
    const { service } = setup();

    await expect(service.get(99)).rejects.toThrow(new NotFoundException('Alert Digest 99 not found'));
    await expect(service.acknowledge(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('acknowledges idempotently, keeping the first acknowledgement', async () => {
    const { service } = setup();

    const first = await service.acknowledge(2);
    const again = await service.acknowledge(2);
    const earlier = await service.acknowledge(1);

    expect(first.acknowledgedAt).toEqual(ACK_TIME);
    expect(again).toEqual(first);
    expect(earlier.acknowledgedAt).toEqual(new Date('2026-10-06T08:00:00Z'));
  });
});
