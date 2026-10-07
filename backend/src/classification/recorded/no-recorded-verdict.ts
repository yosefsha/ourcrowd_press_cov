/**
 * An in-memory classifier was asked about an item it holds no recorded verdict
 * for. A test bug — record the item or ask about a recorded one — so it is
 * deliberately not a `ClassifierUnavailable` a caller might handle.
 */
export class NoRecordedVerdict extends Error {
  constructor(what: string) {
    super(`No recorded verdict for ${what}`);
    this.name = 'NoRecordedVerdict';
  }
}
