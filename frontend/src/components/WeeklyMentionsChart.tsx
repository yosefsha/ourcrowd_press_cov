import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { WeeklySentimentPoint } from '../types.ts';
import { SENTIMENT_COLORS, SENTIMENT_LABELS, toWeeklyChartData } from './companyDetailData.ts';

interface Props {
  series: readonly WeeklySentimentPoint[];
}

/** Stacked from the baseline: negative, then the neutral midpoint, then positive. */
const STACK_ORDER = ['negative', 'neutral', 'positive'] as const;
const AXIS_INK = '#627d98';

/** Weekly Mentions in the Coverage Window, stacked by Sentiment, with a table view of the same numbers. */
export function WeeklyMentionsChart({ series }: Props): React.JSX.Element {
  const data = toWeeklyChartData(series);

  return (
    <section aria-labelledby="weekly-mentions-heading" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 id="weekly-mentions-heading" style={{ margin: 0, fontSize: 15 }}>
        Weekly Mentions
      </h3>
      {data.length === 0 ? (
        <p style={{ margin: 0, color: AXIS_INK }}>No Mentions in this Coverage Window.</p>
      ) : (
        <>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke="#e4e7eb" />
                <XAxis dataKey="label" tick={{ fill: AXIS_INK, fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: AXIS_INK, fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(16, 42, 67, 0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#334e68' }} />
                {STACK_ORDER.map((sentiment, index) => (
                  <Bar
                    key={sentiment}
                    dataKey={sentiment}
                    name={SENTIMENT_LABELS[sentiment]}
                    stackId="sentiment"
                    fill={SENTIMENT_COLORS[sentiment]}
                    stroke="#ffffff"
                    strokeWidth={1}
                    radius={index === STACK_ORDER.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#334e68' }}>Show as table</summary>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr>
                  <th scope="col" style={cellStyle}>Week of</th>
                  {STACK_ORDER.map((sentiment) => (
                    <th key={sentiment} scope="col" style={cellStyle}>
                      {SENTIMENT_LABELS[sentiment]}
                    </th>
                  ))}
                  <th scope="col" style={cellStyle}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.weekStart}>
                    <th scope="row" style={cellStyle}>{row.label}</th>
                    {STACK_ORDER.map((sentiment) => (
                      <td key={sentiment} style={cellStyle}>
                        {row[sentiment]}
                      </td>
                    ))}
                    <td style={cellStyle}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '2px 8px',
  textAlign: 'right',
  borderBottom: '1px solid #e4e7eb',
  fontWeight: 400,
};
