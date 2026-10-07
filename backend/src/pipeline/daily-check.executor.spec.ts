import {
  InMemoryCandidateRepository,
  InMemoryPipelineCompanies,
  InMemoryRunHistory,
  RecordingProgress,
} from '../../test/pipeline/support/in-memory-pipeline-ports';
import {
  AFTER_RECORDINGS,
  CEREBRAS,
  claimedRun,
  FIXTURE_COMPANIES,
  INNOVIZ,
  pipelineWorld,
} from '../../test/pipeline/support/pipeline-world';
import { RecordedNewsSource } from '../../test/pipeline/support/recorded-news';
import { InvalidRunParams } from './collection-window';

const KEYNOTE = 'AMD AAI 2026 Keynote Cerebras';
const PULSE = 'CrowdStrike And Cerebras Partner To Power Falcon AIDR';

function world(options: Parameters<typeof pipelineWorld>[0] = {}): ReturnType<typeof pipelineWorld> & {
  store: InMemoryCandidateRepository;
  companyStore: InMemoryPipelineCompanies;
  runs: InMemoryRunHistory;
} {
  const store = new InMemoryCandidateRepository();
  const companyStore = new InMemoryPipelineCompanies(FIXTURE_COMPANIES);
  const runs = new InMemoryRunHistory();
  return {
    ...pipelineWorld({ candidates: store, companies: companyStore, history: runs, ...options }),
    store,
    companyStore,
    runs,
  };
}

describe('DailyCheckExecutor over recorded Google News results', () => {
  it('after a Backfill cut off at until, confirms the later days as Mentions of this Run and raises its digest', async () => {
    const { backfill, dailyCheck, store, digests } = world();
    await backfill.execute(claimedRun(1, 'backfill', { until: '2026-07-23' }), new RecordingProgress());
    const progress = new RecordingProgress();

    const outcome = await dailyCheck.execute(claimedRun(2, 'daily_check'), progress);

    expect(outcome).toEqual({ status: 'completed' });
    expect(digests.runIds).toEqual([2]);
    const confirmedNow = store.candidates.filter((candidate) => candidate.confirmedInRunId === 2);
    expect(confirmedNow).toHaveLength(8);
    expect(store.byTitle(CEREBRAS.id).get(PULSE)).toMatchObject({ fetchedInRunId: 2, confirmedInRunId: 2 });
    expect(store.byTitle(CEREBRAS.id).get(KEYNOTE)).toMatchObject({ fetchedInRunId: 1, confirmedInRunId: 1 });
    expect([...store.byTitle(INNOVIZ.id).values()].filter((c) => c.relevance === 'relevant')).toHaveLength(7);
    expect(progress.last).toMatchObject({ companiesDone: 3, mentionsConfirmed: 8, candidatesFound: 11 });
  });

  it('reaches seven days back when no Daily Check has succeeded yet', async () => {
    const { dailyCheck, news } = world();

    await dailyCheck.execute(claimedRun(2, 'daily_check'), new RecordingProgress());

    expect(news.calls[0]?.window).toEqual({ from: new Date('2026-07-24T12:00:00Z'), to: AFTER_RECORDINGS });
  });

  it('starts one day before the start of the last successful Daily Check, ignoring itself', async () => {
    const { dailyCheck, news, runs } = world();
    runs.recordSuccess(5, 'daily_check', new Date('2026-07-29T04:00:00Z'));
    runs.recordSuccess(9, 'daily_check', new Date('2026-07-31T11:00:00Z'));
    runs.recordSuccess(6, 'backfill', new Date('2026-07-30T04:00:00Z'));

    await dailyCheck.execute(claimedRun(9, 'daily_check'), new RecordingProgress());

    expect(news.calls[0]?.window.from).toEqual(new Date('2026-07-28T04:00:00Z'));
  });

  it('confirms a Candidate a failed earlier Run left pending — confirmation, not first fetch, makes it new', async () => {
    const { backfill, dailyCheck, store, classifiers } = world();
    classifiers.failRelevance('unavailable');
    await backfill.execute(claimedRun(1, 'backfill', { until: '2026-07-23' }), new RecordingProgress());
    expect(store.byTitle(CEREBRAS.id).get(KEYNOTE)).toMatchObject({ relevance: 'pending' });

    await dailyCheck.execute(claimedRun(2, 'daily_check'), new RecordingProgress());

    expect(store.byTitle(CEREBRAS.id).get(KEYNOTE)).toMatchObject({
      relevance: 'relevant',
      fetchedInRunId: 1,
      confirmedInRunId: 2,
    });
  });

  it('does not reclassify or re-stamp what an overlapping earlier Daily Check already confirmed', async () => {
    const { dailyCheck, store, classifiers, runs } = world();
    await dailyCheck.execute(claimedRun(2, 'daily_check'), new RecordingProgress());
    runs.recordSuccess(2, 'daily_check', new Date('2026-07-30T12:00:00Z'));
    classifiers.relevanceCalls.length = 0;
    const before = store.candidates.map((candidate) => ({ ...candidate }));

    const outcome = await dailyCheck.execute(claimedRun(3, 'daily_check'), new RecordingProgress());

    expect(outcome).toEqual({ status: 'completed' });
    expect(classifiers.relevanceCalls).toEqual([]);
    expect(store.candidates).toEqual(before);
    expect(store.candidates.some((candidate) => candidate.confirmedInRunId === 3)).toBe(false);
  });

  it('can raise coverage_capped but never clears it', async () => {
    const news = new RecordedNewsSource().capFor('Innoviz', 'en-US');
    const { dailyCheck, companyStore } = world({ news });

    await dailyCheck.execute(claimedRun(2, 'daily_check'), new RecordingProgress());

    expect(companyStore.cappedRecords).toEqual([{ id: INNOVIZ.id, capped: true }]);
  });

  it('still builds the digest when the classifier threshold stopped the Run', async () => {
    const { dailyCheck, digests, classifiers } = world({ settings: { classifierFailureThreshold: 1 } });
    classifiers.failRelevance(null, 'unavailable');

    const outcome = await dailyCheck.execute(claimedRun(2, 'daily_check'), new RecordingProgress());

    expect(outcome.status).toBe('failed');
    expect(digests.runIds).toEqual([2]);
  });

  it('fails the Run, keeping its company errors, when the digest cannot be built', async () => {
    const news = new RecordedNewsSource().failFor('Groq', 'he-IL');
    const { dailyCheck, digests } = world({ news });
    digests.failure = new Error('alert_digests is not writable');

    const outcome = await dailyCheck.execute(claimedRun(2, 'daily_check'), new RecordingProgress());

    expect(outcome).toEqual({
      status: 'failed',
      error: 'The Alert Digest could not be built: alert_digests is not writable',
      companyErrors: [expect.objectContaining({ companyId: 2, stage: 'collection' })],
    });
  });

  it.each([
    ['an until cutoff', { until: '2026-07-23' }],
    ['re-process', { companyIds: [CEREBRAS.id], reprocess: true }],
  ])('refuses %s', async (_name, params) => {
    const { dailyCheck, news, digests } = world();

    await expect(dailyCheck.execute(claimedRun(2, 'daily_check', params), new RecordingProgress())).rejects.toThrow(
      InvalidRunParams,
    );
    expect(news.calls).toEqual([]);
    expect(digests.runIds).toEqual([]);
  });

  it('refuses a Run of the other type', async () => {
    const { dailyCheck } = world();

    await expect(dailyCheck.execute(claimedRun(1, 'backfill'), new RecordingProgress())).rejects.toThrow(InvalidRunParams);
  });
});
