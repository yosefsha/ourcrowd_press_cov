/** A half-open period of time: `from` inclusive, `to` exclusive. */
export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}
