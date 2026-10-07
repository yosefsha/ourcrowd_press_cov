import { describeLastMention, formatMentionCount, toSafeHttpUrl } from '../coverageFormat.ts';
import type { CompanyOverviewRow, CompanySort, IsoDateTime } from '../types.ts';
import { SentimentBar } from './SentimentBar.tsx';
import { StatusBadge } from './StatusBadge.tsx';

interface Props {
  rows: readonly CompanyOverviewRow[];
  sort: CompanySort;
  onSortChange: (sort: CompanySort) => void;
  onSelectCompany: (id: number) => void;
  /** Reference time for "3 days ago" labels. */
  now: Date;
  /** Shown as "No coverage found since <date>" for companies never mentioned. */
  noCoverageSince: IsoDateTime | null;
}

interface Column {
  readonly label: string;
  /** The sort this column's header applies; absent for columns that do not sort. */
  readonly sort?: CompanySort;
  readonly title?: string;
}

const COLUMNS: readonly Column[] = [
  { label: 'Company', sort: 'name', title: 'Sort by name, A to Z' },
  { label: 'Mention status', sort: 'recency', title: 'Sort by most recent Mention' },
  { label: 'Mentions', sort: 'mentions', title: 'Sort by Mentions in window, most first' },
  { label: 'Sentiment', sort: 'negatives', title: 'Sort by negative Mentions, most first, then recency' },
  { label: 'Latest headline' },
];

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #e4e7eb',
  textAlign: 'left',
  verticalAlign: 'middle',
};

const plainButtonStyle: React.CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
};

/** Name sorts A to Z; every other sort puts the largest or most recent first. */
function ariaSort(column: Column, active: CompanySort): 'ascending' | 'descending' | undefined {
  if (column.sort !== active) return undefined;
  return column.sort === 'name' ? 'ascending' : 'descending';
}

/** One row per Tracked Company, in the order the API returned them. Clicking a row opens its detail. */
export function CompanyTable({
  rows,
  sort,
  onSortChange,
  onSelectCompany,
  now,
  noCoverageSince,
}: Props): React.JSX.Element {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff', fontSize: 14 }}>
      <thead>
        <tr>
          {COLUMNS.map((column) => {
            const columnSort = column.sort;
            const active = columnSort === sort;
            return (
              <th
                key={column.label}
                scope="col"
                aria-sort={ariaSort(column, sort)}
                style={{ ...cellStyle, fontSize: 12, color: '#486581', fontWeight: 600 }}
              >
                {columnSort === undefined ? (
                  column.label
                ) : (
                  <button
                    type="button"
                    title={column.title}
                    onClick={() => {
                      onSortChange(columnSort);
                    }}
                    style={{ ...plainButtonStyle, fontWeight: active ? 700 : 600 }}
                  >
                    {column.label}
                    {active ? (columnSort === 'name' ? ' ▲' : ' ▼') : null}
                  </button>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const headlineUrl = row.latestHeadline === null ? null : toSafeHttpUrl(row.latestHeadline.url);
          return (
            <tr
              key={row.id}
              onClick={() => {
                onSelectCompany(row.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <th scope="row" style={{ ...cellStyle, fontWeight: 600 }}>
                {/* The button makes the row reachable from the keyboard; the row click covers the mouse. */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectCompany(row.id);
                  }}
                  style={{ ...plainButtonStyle, fontWeight: 600 }}
                >
                  {row.displayName}
                </button>
              </th>
              <td style={cellStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <StatusBadge status={row.mentionStatus} />
                  <span style={{ fontSize: 12, color: '#486581' }}>
                    {describeLastMention(row.lastMentionAt, now, noCoverageSince)}
                  </span>
                </div>
              </td>
              <td
                style={cellStyle}
                title={row.capped ? "Collection hit the News Source's result cap; coverage may be incomplete" : undefined}
              >
                {formatMentionCount(row.mentionCount, row.capped)}
              </td>
              <td style={cellStyle}>
                <SentimentBar sentiment={row.sentiment} />
              </td>
              <td style={{ ...cellStyle, maxWidth: 420 }}>
                {row.latestHeadline === null ? (
                  <span style={{ color: '#829ab1' }}>—</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {headlineUrl === null ? (
                      <span>{row.latestHeadline.title}</span>
                    ) : (
                      <a
                        href={headlineUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        style={{ color: '#0b69a3' }}
                      >
                        {row.latestHeadline.title}
                      </a>
                    )}
                    <span style={{ fontSize: 12, color: '#486581' }}>{row.latestHeadline.outletName}</span>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
