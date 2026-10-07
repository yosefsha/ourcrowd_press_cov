/** The classification model could not be reached or did not answer in time. */
export class ClassifierUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ClassifierUnavailable';
  }
}

/**
 * Longest excerpt of a raw model answer kept on a `ClassifierOutputInvalid`.
 * The answer echoes untrusted article text and can be arbitrarily long, so only
 * a bounded excerpt may reach logs or Run error messages.
 */
export const MAX_DIAGNOSTIC_OUTPUT_LENGTH = 500;

/** `text` cut to at most `maxLength` characters, marked with an ellipsis when cut. */
export function truncateForDiagnosis(text: string, maxLength = MAX_DIAGNOSTIC_OUTPUT_LENGTH): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

/** The classification model answered, but not with a verdict that could be read. */
export class ClassifierOutputInvalid extends Error {
  /**
   * An excerpt of the raw answer (at most `MAX_DIAGNOSTIC_OUTPUT_LENGTH`
   * characters), kept for diagnosis. Never part of `message`.
   */
  readonly output: string;

  constructor(message: string, output: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ClassifierOutputInvalid';
    this.output = truncateForDiagnosis(output);
  }
}
