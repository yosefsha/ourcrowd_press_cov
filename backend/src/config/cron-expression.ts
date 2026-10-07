/** Allowed range of each field of a five-field cron expression. */
const FIELDS = [
  { name: 'minute', min: 0, max: 59, names: [] },
  { name: 'hour', min: 0, max: 23, names: [] },
  { name: 'day of month', min: 1, max: 31, names: [] },
  {
    name: 'month',
    min: 1,
    max: 12,
    names: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  },
  // 0 and 7 are both Sunday.
  { name: 'day of week', min: 0, max: 7, names: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
] as const;

const TERM = /^(\*|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d+))?$/i;

function valueOf(token: string, field: (typeof FIELDS)[number]): number | null {
  if (/^\d+$/.test(token)) {
    const value = Number(token);
    return value >= field.min && value <= field.max ? value : null;
  }
  const index = (field.names as readonly string[]).indexOf(token.toLowerCase());
  if (index === -1) return null;
  return field.name === 'month' ? index + 1 : index;
}

function isValidTerm(term: string, field: (typeof FIELDS)[number]): boolean {
  const match = TERM.exec(term);
  if (match === null) return false;
  const [, range = '', step] = match;
  if (step !== undefined && Number(step) < 1) return false;
  if (range === '*') return true;
  const [start, end] = range.split('-');
  const first = valueOf(start ?? '', field);
  if (first === null) return false;
  if (end === undefined) return true;
  const last = valueOf(end, field);
  return last !== null && first <= last;
}

/**
 * True for a standard five-field cron expression (minute hour day-of-month
 * month day-of-week) with `*`, numbers or names, ranges, lists and steps —
 * what the collector's daily-check scheduler accepts.
 */
export function isCronExpression(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== FIELDS.length) return false;
  return fields.every((value, index) => {
    const field = FIELDS[index];
    return field !== undefined && value.split(',').every((term) => isValidTerm(term, field));
  });
}
