/** An Article as a News Source returns it, before it is stored. */
export interface FoundArticle {
  /** The `CBMi…` token of the Google News link — the Article's identity (ADR-008). */
  readonly googleArticleId: string;
  readonly title: string;
  readonly snippet: string;
  readonly outletName: string;
  readonly outletUrl: string;
  readonly googleUrl: string;
  /** The Outlet's own URL when it could be resolved; null otherwise. */
  readonly publisherUrl: string | null;
  readonly publishedAt: Date;
  readonly language: string;
  /** The News Edition it was found in, e.g. `en-US`. */
  readonly edition: string;
}

/** The part of an Article a classifier reads. */
export type ClassifiableArticle = Pick<
  FoundArticle,
  'title' | 'snippet' | 'outletName' | 'publishedAt' | 'language'
>;
