import { describeSentiment } from '../coverageFormat.ts';
import { SENTIMENTS, type Sentiment, type SentimentSplit } from '../types.ts';

interface Props {
  sentiment: SentimentSplit;
  width?: number;
}

const SENTIMENT_COLORS: Readonly<Record<Sentiment, string>> = {
  positive: '#3ebd93',
  negative: '#e12d39',
  neutral: '#9aa5b1',
};

/** Horizontal bar of Mentions per Sentiment, each segment proportional to its count. */
export function SentimentBar({ sentiment, width = 120 }: Props): React.JSX.Element {
  const total = SENTIMENTS.reduce((sum, key) => sum + sentiment[key], 0);
  const label = total === 0 ? 'No Mentions' : describeSentiment(sentiment);
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      style={{ display: 'flex', width, height: 10, borderRadius: 5, overflow: 'hidden', background: '#e4e7eb' }}
    >
      {total === 0
        ? null
        : SENTIMENTS.filter((key) => sentiment[key] > 0).map((key) => (
            <span key={key} style={{ flex: sentiment[key], background: SENTIMENT_COLORS[key] }} />
          ))}
    </div>
  );
}
