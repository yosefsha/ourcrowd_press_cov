/** An Article on the wire. URL fields only ever hold http(s) URLs (empty when the stored one is not). */
export class ArticleDto {
  readonly id!: number;
  readonly title!: string;
  readonly snippet!: string;
  readonly outletName!: string;
  readonly outletUrl!: string;
  readonly googleUrl!: string;
  readonly publisherUrl!: string | null;
  /** ISO-8601. */
  readonly publishedAt!: string;
  readonly language!: string;
  readonly edition!: string;

  constructor(fields: ArticleDto) {
    Object.assign(this, fields);
  }
}
