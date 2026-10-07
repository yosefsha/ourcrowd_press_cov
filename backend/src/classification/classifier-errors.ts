/** The classification model could not be reached or did not answer in time. */
export class ClassifierUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ClassifierUnavailable';
  }
}

/** The classification model answered, but not with a verdict that could be read. */
export class ClassifierOutputInvalid extends Error {
  constructor(
    message: string,
    /** The raw answer, kept for diagnosis. */
    readonly output: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ClassifierOutputInvalid';
  }
}
