/** The headline of an overview row: the most recent Mention in the window, linked to the Outlet when possible. */
export class HeadlineDto {
  readonly title!: string;
  readonly outletName!: string;
  /** The publisher URL, else the Google News URL; always http(s). */
  readonly url!: string;
  /** ISO-8601. */
  readonly publishedAt!: string;

  constructor(fields: HeadlineDto) {
    Object.assign(this, fields);
  }
}
