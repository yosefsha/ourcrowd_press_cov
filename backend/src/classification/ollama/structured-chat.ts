/** A JSON Schema object constraining the model's answer. */
export type JsonSchema = Readonly<Record<string, unknown>>;

/** One question to the model: fixed instructions, the item, and the answer's shape. */
export interface StructuredChatRequest {
  readonly system: string;
  readonly user: string;
  readonly schema: JsonSchema;
}

/**
 * The one capability the classifiers need from a chat model: answer a request
 * deterministically with text constrained to a JSON Schema. Throws
 * `ClassifierUnavailable` when the model cannot be reached or times out.
 */
export interface StructuredChat {
  /** The raw answer text — still untrusted; the caller validates it. */
  complete(request: StructuredChatRequest): Promise<string>;
}
