/** Whether a Mention is positive, negative or neutral toward the Tracked Company. */
export const SENTIMENTS = ['positive', 'negative', 'neutral'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

/** A Sentiment judged for one Mention, with the classifier's short reason. */
export interface SentimentVerdict {
  readonly sentiment: Sentiment;
  readonly reason: string;
}

/** Narrows an untrusted value (e.g. model output) to a Sentiment. */
export function isSentiment(value: unknown): value is Sentiment {
  return typeof value === 'string' && (SENTIMENTS as readonly string[]).includes(value);
}
