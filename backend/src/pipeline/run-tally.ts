import type { RunCompanyError, RunOutcome, RunProgress, RunStage } from '../domain/run';

/** Classifier failures of one stage for the company being processed. */
interface StageFailures {
  count: number;
  firstMessage: string;
}

/**
 * The running totals of one Run: its progress counters and the per-company
 * errors it will end with. Mutable on purpose — one instance lives for the
 * duration of a single `execute` call and is never shared.
 */
export class RunTally {
  private companiesDone = 0;
  private candidatesFound = 0;
  private candidatesClassified = 0;
  private mentionsConfirmed = 0;
  private currentCompany: string | null = null;
  private readonly errors: RunCompanyError[] = [];
  private readonly pendingFailures = new Map<RunStage, StageFailures>();

  constructor(private readonly companiesTotal: number) {}

  startCompany(displayName: string): void {
    this.currentCompany = displayName;
    this.pendingFailures.clear();
  }

  /** Closes the company: its classifier failures become one error per stage. */
  finishCompany(companyId: number): void {
    this.flushClassifierFailures(companyId);
    this.companiesDone += 1;
    this.currentCompany = null;
  }

  found(count: number): void {
    this.candidatesFound += count;
  }

  classified(asMention: boolean): void {
    this.candidatesClassified += 1;
    if (asMention) this.mentionsConfirmed += 1;
  }

  companyError(error: RunCompanyError): void {
    this.errors.push(error);
  }

  /** A Candidate of the current company was left pending because a classifier failed. */
  classifierFailed(stage: RunStage, message: string): void {
    const failures = this.pendingFailures.get(stage);
    if (failures === undefined) this.pendingFailures.set(stage, { count: 1, firstMessage: message });
    else failures.count += 1;
  }

  progress(): RunProgress {
    return {
      companiesTotal: this.companiesTotal,
      companiesDone: this.companiesDone,
      candidatesFound: this.candidatesFound,
      candidatesClassified: this.candidatesClassified,
      mentionsConfirmed: this.mentionsConfirmed,
      companyErrors: this.errors.length + this.pendingFailures.size,
      currentCompany: this.currentCompany,
    };
  }

  /** The outcome of a Run that went through every company. */
  completed(): RunOutcome {
    const [first, ...rest] = this.errors;
    return first === undefined
      ? { status: 'completed' }
      : { status: 'completed_with_errors', companyErrors: [first, ...rest] };
  }

  /** The outcome of a Run that had to stop; `companyId` is the company it stopped in. */
  failed(error: string, companyId: number | null): RunOutcome {
    if (companyId !== null) this.flushClassifierFailures(companyId);
    return { status: 'failed', error, companyErrors: [...this.errors] };
  }

  private flushClassifierFailures(companyId: number): void {
    for (const [stage, failures] of this.pendingFailures) {
      this.errors.push({
        companyId,
        stage,
        message: `${failures.count} Candidate(s) left pending for the next Run: ${failures.firstMessage}`,
      });
    }
    this.pendingFailures.clear();
  }
}
