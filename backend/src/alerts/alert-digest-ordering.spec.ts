import { recordedMention } from '../../test/fixtures/alerts/recorded-mentions';
import { groupNegativeFirst } from './alert-digest-ordering';

const RUN = 2;

function order(mentions: ReturnType<typeof recordedMention>[]): { company: string; ids: number[] }[] {
  return groupNegativeFirst(mentions, (mention) => mention.publishedAt).map((group) => ({
    company: group.displayName,
    ids: group.mentions.map((mention) => mention.candidateId),
  }));
}

describe('groupNegativeFirst', () => {
  it('returns no groups for no Mentions', () => {
    expect(order([])).toEqual([]);
  });

  it('puts a company with one negative Mention above one with more routine coverage', () => {
    expect(
      order([
        recordedMention('zutacoreDcdPartnership', 1, 'positive', RUN),
        recordedMention('zutacoreBusinessWirePartnership', 2, 'positive', RUN),
        recordedMention('morphisecAiTrust', 3, 'negative', RUN),
      ]),
    ).toEqual([
      { company: 'Morphisec', ids: [3] },
      { company: 'ZutaCore', ids: [1, 2] },
    ]);
  });

  it('orders Mentions negative, positive, neutral, newest first within each', () => {
    expect(
      order([
        recordedMention('zutacoreFunding', 1, 'positive', RUN), // 2026-06-02
        recordedMention('zutacoreDcdPartnership', 2, 'neutral', RUN),
        recordedMention('zutacoreBusinessWirePartnership', 3, 'positive', RUN), // 2026-09-23
        recordedMention('zutacoreFunding', 4, 'negative', RUN),
      ]),
    ).toEqual([{ company: 'ZutaCore', ids: [4, 3, 1, 2] }]);
  });

  it('breaks ties between companies without negatives by Mention count, then name', () => {
    expect(
      order([
        recordedMention('oncohostAward', 1, 'positive', RUN),
        recordedMention('morphisecAiTrust', 2, 'positive', RUN),
        recordedMention('zutacoreDcdPartnership', 3, 'neutral', RUN),
        recordedMention('zutacoreFunding', 4, 'neutral', RUN),
      ]).map((group) => group.company),
    ).toEqual(['ZutaCore', 'Morphisec', 'OncoHost']);
  });
});
