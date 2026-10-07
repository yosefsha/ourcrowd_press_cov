import {
  InMemoryCandidateRepository,
  InMemoryPipelineCompanies,
  RecordingProgress,
} from '../../test/pipeline/support/in-memory-pipeline-ports';
import {
  ARBE_NEEDS_REVIEW,
  CEREBRAS,
  claimedRun,
  FIXTURE_COMPANIES,
  GROQ,
  HAILO_DEACTIVATED,
  INNOVIZ,
  pipelineWorld,
} from '../../test/pipeline/support/pipeline-world';
import { RecordedNewsSource } from '../../test/pipeline/support/recorded-news';
import { InvalidRunParams } from './collection-window';
import { NAME_ABSENT_REASON } from './company-collection.service';

const WCCFTECH =
  'AMD Fires Back At NVIDIA’s Groq Bet, Fuses The Cerebras Wafer-Scale Engine With Helios For 5x Higher Tokens Per Second Per Watt';
const REGISTER = 'AMD and Cerebras join forces against Nvidia’s Groq LPUs';
const CNBC = 'Cerebras stock gains on AMD partnership';

function world(options: Parameters<typeof pipelineWorld>[0] = {}): ReturnType<typeof pipelineWorld> & {
  store: InMemoryCandidateRepository;
  companyStore: InMemoryPipelineCompanies;
} {
  const store = new InMemoryCandidateRepository();
  const companyStore = new InMemoryPipelineCompanies(FIXTURE_COMPANIES);
  return { ...pipelineWorld({ candidates: store, companies: companyStore, ...options }), store, companyStore };
}

describe('BackfillExecutor over recorded Google News results', () => {
  it('collects, de-duplicates and classifies every active company', async () => {
    const { backfill, store, companyStore } = world();
    const progress = new RecordingProgress();

    const outcome = await backfill.execute(claimedRun(1, 'backfill'), progress);

    expect(outcome).toEqual({ status: 'completed' });
    expect(store.candidates).toHaveLength(24);
    expect(store.articles.size).toBe(20);
    expect(store.candidates.filter((candidate) => candidate.relevance === 'pending')).toEqual([]);
    expect(store.candidates.filter((candidate) => candidate.relevance === 'relevant')).toHaveLength(15);
    expect(store.candidates.every((candidate) => candidate.fetchedInRunId === 1)).toBe(true);
    expect(progress.last).toEqual({
      companiesTotal: 3,
      companiesDone: 3,
      candidatesFound: 24,
      candidatesClassified: 24,
      mentionsConfirmed: 15,
      companyErrors: 0,
      currentCompany: null,
    });
    expect(companyStore.cappedRecords).toEqual([
      { id: CEREBRAS.id, capped: false },
      { id: GROQ.id, capped: false },
      { id: INNOVIZ.id, capped: false },
    ]);
  });

  it('stores an Article found for two companies once, as one Candidate per company — two Mentions', async () => {
    const { backfill, store } = world();

    await backfill.execute(claimedRun(1, 'backfill'), new RecordingProgress());

    const cerebras = store.byTitle(CEREBRAS.id).get(WCCFTECH);
    const groq = store.byTitle(GROQ.id).get(WCCFTECH);
    expect(cerebras?.googleArticleId).toBe(groq?.googleArticleId);
    expect([...store.articles.values()].filter((article) => article.title === WCCFTECH)).toHaveLength(1);
    expect(cerebras).toMatchObject({ relevance: 'relevant', sentiment: 'positive', confirmedInRunId: 1 });
    expect(groq).toMatchObject({ relevance: 'relevant', sentiment: 'neutral', confirmedInRunId: 1 });
    // The same story can be a Mention of one company and not of the other.
    expect(store.byTitle(CEREBRAS.id).get(REGISTER)).toMatchObject({ relevance: 'relevant' });
    expect(store.byTitle(GROQ.id).get(REGISTER)).toMatchObject({ relevance: 'rejected', relevanceMethod: 'llm' });
  });

  it('rejects Candidates that never name the company before asking the classifier', async () => {
    const { backfill, store, classifiers } = world();

    await backfill.execute(claimedRun(1, 'backfill'), new RecordingProgress());

    const nameAbsent = store.candidates.filter((candidate) => candidate.relevanceMethod === 'name_absent');
    expect(nameAbsent).toHaveLength(8);
    expect(nameAbsent.every((candidate) => candidate.relevanceReason === NAME_ABSENT_REASON)).toBe(true);
    expect(store.byTitle(GROQ.id).get(CNBC)).toMatchObject({ relevance: 'rejected', relevanceMethod: 'name_absent' });
    expect(store.byTitle(INNOVIZ.id).get('הישראלית שצנחה אתמול ב-30%: והחלום שהיא עוד מנסה למכור')).toMatchObject({
      relevance: 'rejected',
      relevanceMethod: 'name_absent',
    });
    expect(store.byTitle(INNOVIZ.id).get('מניות אינוויז צונחות ב-30%: מגייסת 30 מיליון דולר בדיסקאונט חד')).toMatchObject({
      relevance: 'relevant',
      sentiment: 'negative',
    });
    expect(classifiers.relevanceCalls).not.toContain(`Groq|${CNBC}`);
    expect(classifiers.relevanceCalls).toHaveLength(24 - 8);
  });

  it('stores an Article listed by two editions once, under the edition that listed it first', async () => {
    const news = new RecordedNewsSource().replay('Groq', 'en-US', 'he-IL');
    const { backfill, store } = world({ news });

    await backfill.execute(claimedRun(1, 'backfill'), new RecordingProgress());

    expect(store.byTitle(GROQ.id).size).toBe(6);
    expect(store.articles.size).toBe(20);
    expect([...store.articles.values()].filter((article) => article.edition === 'he-IL')).toHaveLength(6);
    expect(store.articles.get(store.byTitle(GROQ.id).get(WCCFTECH)?.googleArticleId ?? '')?.edition).toBe('en-US');
  });

  it('never collects Needs Review or deactivated companies, even when asked for by id', async () => {
    const { backfill, news } = world();

    await backfill.execute(
      claimedRun(1, 'backfill', { companyIds: [GROQ.id, ARBE_NEEDS_REVIEW.id, HAILO_DEACTIVATED.id] }),
      new RecordingProgress(),
    );

    expect(new Set(news.calls.map((call) => call.company))).toEqual(new Set(['Groq']));
    expect(news.calls.map((call) => call.edition)).toEqual(['en-US', 'he-IL']);
  });

  it('respects the until cutoff even when the source returns later Articles', async () => {
    const news = new RecordedNewsSource({ ignoreWindow: true });
    const { backfill, store } = world({ news });

    await backfill.execute(claimedRun(1, 'backfill', { until: '2026-07-23' }), new RecordingProgress());

    const cutoff = new Date('2026-07-23T21:00:00Z');
    expect(news.calls.every((call) => call.window.to.getTime() === cutoff.getTime())).toBe(true);
    const stored = [...store.articles.values()];
    expect(stored.every((article) => article.publishedAt < cutoff)).toBe(true);
    // 22–23 Jul Cerebras and Groq articles stay; the 25 Jul one and every Innoviz article do not.
    expect(store.byTitle(CEREBRAS.id).has('AMD AAI 2026 Keynote Cerebras')).toBe(true);
    expect(store.byTitle(CEREBRAS.id).has('CrowdStrike And Cerebras Partner To Power Falcon AIDR')).toBe(false);
    expect(store.byTitle(INNOVIZ.id).size).toBe(0);
  });

  it('resumes: a second Backfill classifies only what the first left pending', async () => {
    const { backfill, store, classifiers } = world();
    // Groq's only LLM-judged Candidates fail; nothing reaches the threshold of 5.
    classifiers.failRelevance(null, null, null, null, null, null, null, 'unavailable', 'unavailable');

    const first = await backfill.execute(claimedRun(1, 'backfill'), new RecordingProgress());
    const pendingAfterFirst = store.candidates.filter((candidate) => candidate.relevance === 'pending');
    classifiers.recover();
    classifiers.relevanceCalls.length = 0;
    const second = await backfill.execute(claimedRun(2, 'backfill'), new RecordingProgress());

    expect(first).toEqual({
      status: 'completed_with_errors',
      companyErrors: [
        {
          companyId: GROQ.id,
          stage: 'relevance',
          message: '2 Candidate(s) left pending for the next Run: connect ECONNREFUSED 127.0.0.1:11434',
        },
      ],
    });
    expect(pendingAfterFirst).toHaveLength(2);
    expect(second).toEqual({ status: 'completed' });
    expect([...classifiers.relevanceCalls].sort()).toEqual([`Groq|${REGISTER}`, `Groq|${WCCFTECH}`].sort());
    expect(store.candidates).toHaveLength(24);
    expect(store.byTitle(GROQ.id).get(WCCFTECH)).toMatchObject({ relevance: 'relevant', confirmedInRunId: 2 });
    expect(store.byTitle(CEREBRAS.id).get(WCCFTECH)).toMatchObject({ confirmedInRunId: 1 });
  });

  it('stops as failed after OLLAMA_FAILURE_THRESHOLD consecutive unavailable answers, leaving the rest pending', async () => {
    const { backfill, store, classifiers, news } = world({ settings: { classifierFailureThreshold: 3 } });
    classifiers.goDown();
    const progress = new RecordingProgress();

    const outcome = await backfill.execute(claimedRun(1, 'backfill'), progress);

    expect(outcome).toEqual({
      status: 'failed',
      error: 'The classifier was unavailable for 3 consecutive Candidates: connect ECONNREFUSED 127.0.0.1:11434',
      companyErrors: [
        {
          companyId: CEREBRAS.id,
          stage: 'relevance',
          message: '3 Candidate(s) left pending for the next Run: connect ECONNREFUSED 127.0.0.1:11434',
        },
      ],
    });
    expect(classifiers.relevanceCalls).toHaveLength(3);
    expect(new Set(news.calls.map((call) => call.company))).toEqual(new Set(['Cerebras']));
    // It stopped at Cerebras' third Candidate: all eight stay pending, later companies are never fetched.
    expect(store.candidates).toHaveLength(8);
    expect(store.candidates.every((candidate) => candidate.relevance === 'pending')).toBe(true);
    expect(progress.last).toMatchObject({ companiesDone: 0, mentionsConfirmed: 0, companyErrors: 1 });
  });

  it('does not count unreadable answers toward the threshold, but leaves those Candidates pending', async () => {
    const { backfill, store, classifiers } = world({ settings: { classifierFailureThreshold: 2 } });
    classifiers.failRelevance('unavailable', 'invalid_output', 'unavailable', 'invalid_output');

    const outcome = await backfill.execute(claimedRun(1, 'backfill'), new RecordingProgress());

    expect(outcome.status).toBe('completed_with_errors');
    const errors = outcome.status === 'completed' ? [] : outcome.companyErrors;
    expect(errors.map(({ companyId, stage }) => ({ companyId, stage }))).toEqual([{ companyId: CEREBRAS.id, stage: 'relevance' }]);
    expect(errors[0]?.message).toMatch(/^4 Candidate\(s\) left pending/);
    expect(store.candidates.filter((candidate) => candidate.relevance === 'pending')).toHaveLength(4);
  });

  it('records a sentiment failure under the sentiment stage and leaves the Candidate unconfirmed', async () => {
    const { backfill, store, classifiers } = world();
    classifiers.failSentiment('unavailable');

    const outcome = await backfill.execute(claimedRun(1, 'backfill', { companyIds: [CEREBRAS.id] }), new RecordingProgress());

    expect(outcome.status !== 'completed' && outcome.companyErrors).toEqual([
      expect.objectContaining({ companyId: CEREBRAS.id, stage: 'sentiment' }),
    ]);
    const pending = store.candidates.filter((candidate) => candidate.relevance === 'pending');
    expect(pending).toEqual([expect.objectContaining({ sentiment: null, confirmedInRunId: null })]);
  });

  it('records a News Source failure against the company and carries on with the others', async () => {
    const news = new RecordedNewsSource().failFor('Groq', 'en-US');
    const { backfill, store, companyStore } = world({ news });
    const progress = new RecordingProgress();

    const outcome = await backfill.execute(claimedRun(1, 'backfill'), progress);

    expect(outcome).toEqual({
      status: 'completed_with_errors',
      companyErrors: [
        { companyId: GROQ.id, stage: 'collection', message: 'en-US: Google News answered 503 Service Unavailable' },
      ],
    });
    expect(store.byTitle(GROQ.id).size).toBe(0);
    expect(store.byTitle(INNOVIZ.id).size).toBe(10);
    // An incomplete collection says nothing about whether coverage is capped.
    expect(companyStore.cappedRecords.map((record) => record.id)).toEqual([CEREBRAS.id, INNOVIZ.id]);
    expect(progress.last).toMatchObject({ companiesDone: 3, companyErrors: 1 });
  });

  it('re-process deletes the company’s Candidates first, then refetches and reclassifies them', async () => {
    const { backfill, store, news } = world();
    await backfill.execute(claimedRun(1, 'backfill'), new RecordingProgress());
    news.calls.length = 0;

    const outcome = await backfill.execute(
      claimedRun(2, 'backfill', { companyIds: [CEREBRAS.id], reprocess: true }),
      new RecordingProgress(),
    );

    expect(outcome).toEqual({ status: 'completed' });
    expect(store.discarded).toEqual([CEREBRAS.id]);
    expect(new Set(news.calls.map((call) => call.company))).toEqual(new Set(['Cerebras']));
    const cerebras = [...store.byTitle(CEREBRAS.id).values()];
    expect(cerebras).toHaveLength(8);
    expect(cerebras.every((candidate) => candidate.fetchedInRunId === 2)).toBe(true);
    expect(cerebras.filter((candidate) => candidate.relevance === 'relevant').every((c) => c.confirmedInRunId === 2)).toBe(true);
    // Groq's Candidates — including those for Articles shared with Cerebras — are untouched.
    expect(store.byTitle(GROQ.id).get(WCCFTECH)).toMatchObject({ fetchedInRunId: 1, confirmedInRunId: 1 });
    expect(store.articles.size).toBe(20);
  });

  it('refuses to re-process without naming the companies', async () => {
    const { backfill, store } = world();

    await expect(backfill.execute(claimedRun(1, 'backfill', { reprocess: true }), new RecordingProgress())).rejects.toThrow(
      InvalidRunParams,
    );
    expect(store.discarded).toEqual([]);
  });

  it('applies MAX_CANDIDATES_PER_COMPANY, keeping the newest, and flags the coverage as capped', async () => {
    const { backfill, store, companyStore } = world({ settings: { maxCandidatesPerCompany: 3 } });

    await backfill.execute(claimedRun(1, 'backfill', { companyIds: [CEREBRAS.id] }), new RecordingProgress());

    expect([...store.byTitle(CEREBRAS.id).keys()]).toEqual([
      'CrowdStrike And Cerebras Partner To Power Falcon AIDR',
      'AMD AAI 2026 Keynote Cerebras',
      expect.any(String),
    ]);
    expect(companyStore.cappedRecords).toEqual([{ id: CEREBRAS.id, capped: true }]);
  });

  it('flags the coverage as capped when the source stopped at its result cap', async () => {
    const news = new RecordedNewsSource().capFor('Innoviz', 'he-IL');
    const { backfill, companyStore } = world({ news });

    await backfill.execute(claimedRun(1, 'backfill', { companyIds: [INNOVIZ.id] }), new RecordingProgress());

    expect(companyStore.cappedRecords).toEqual([{ id: INNOVIZ.id, capped: true }]);
  });

  it('never builds an Alert Digest', async () => {
    const { backfill, digests } = world();

    await backfill.execute(claimedRun(1, 'backfill'), new RecordingProgress());

    expect(digests.runIds).toEqual([]);
  });

  it('refuses a Run of the other type', async () => {
    const { backfill } = world();

    await expect(backfill.execute(claimedRun(1, 'daily_check'), new RecordingProgress())).rejects.toThrow(InvalidRunParams);
  });

  it('lets a failure it cannot interpret fail the whole Run', async () => {
    const store = new InMemoryCandidateRepository();
    store.pendingFor = (): never => {
      throw new Error('disk full');
    };
    const { backfill } = world({ candidates: store });

    await expect(backfill.execute(claimedRun(1, 'backfill'), new RecordingProgress())).rejects.toThrow('disk full');
  });
});
