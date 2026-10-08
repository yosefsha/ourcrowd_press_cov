/** Mentions per Sentiment in the week (Monday start) beginning on `weekStart`. */
export class WeeklySentimentPointDto {
  /** `YYYY-MM-DD`. */
  readonly weekStart!: string;
  readonly positive!: number;
  readonly negative!: number;
  readonly neutral!: number;

  constructor(fields: WeeklySentimentPointDto) {
    Object.assign(this, fields);
  }
}
