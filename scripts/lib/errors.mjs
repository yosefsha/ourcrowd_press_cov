/**
 * A problem the person running the script can fix themselves: a missing tool,
 * a busy port, a step they have not run yet. It carries the exact fix, which
 * the CLI wrapper prints before exiting non-zero.
 */
export class PrerequisiteError extends Error {
  /**
   * @param {string} problem What is wrong, in one sentence.
   * @param {string} fix The exact command or action that resolves it.
   */
  constructor(problem, fix) {
    super(problem);
    this.name = 'PrerequisiteError';
    /** @readonly */
    this.problem = problem;
    /** @readonly */
    this.fix = fix;
  }
}

/**
 * Several prerequisites failed at once. Reporting them together saves the
 * person a fix-rerun-fix loop.
 */
export class PrerequisiteErrors extends Error {
  /** @param {readonly PrerequisiteError[]} errors */
  constructor(errors) {
    super(errors.map((error) => error.problem).join('; '));
    this.name = 'PrerequisiteErrors';
    /** @readonly */
    this.errors = errors;
  }
}

/** A child command exited non-zero. Its own output already explains why. */
export class CommandFailedError extends Error {
  /**
   * @param {string} command
   * @param {number | null} status
   */
  constructor(command, status) {
    super(`\`${command}\` failed (exit code ${status ?? 'unknown'}).`);
    this.name = 'CommandFailedError';
    /** @readonly */
    this.status = status;
  }
}
