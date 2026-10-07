/** Characters that make a spreadsheet read a cell as a formula (CSV injection, OWASP). */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/** Lets spreadsheets detect UTF-8. */
const BYTE_ORDER_MARK = '\uFEFF';

/** Characters that force a cell to be quoted (RFC 4180). */
const NEEDS_QUOTING = /[",\r\n]/;

/**
 * One CSV cell. A cell a spreadsheet would evaluate as a formula is prefixed
 * with `'`, so a headline like `=HYPERLINK(...)` is shown as text; a cell with
 * a quote, comma or line break is quoted with inner quotes doubled.
 */
export function csvCell(value: string | null): string {
  if (value === null || value === '') return '';
  const neutralised = FORMULA_TRIGGERS.has(value[0]) ? `'${value}` : value;
  return NEEDS_QUOTING.test(neutralised) ? `"${neutralised.replaceAll('"', '""')}"` : neutralised;
}

/**
 * A whole CSV document: a header and one line per row, CRLF line endings
 * (RFC 4180), with a UTF-8 byte order mark so spreadsheets read Hebrew
 * headlines correctly.
 */
export function csvDocument(header: readonly string[], rows: readonly (readonly (string | null)[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
  return `${BYTE_ORDER_MARK}${lines.join('\r\n')}\r\n`;
}
