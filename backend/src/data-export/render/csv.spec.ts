import { csvCell, csvDocument } from './csv';

describe('csvCell', () => {
  it('leaves a plain cell as it is', () => {
    expect(csvCell('Data Center Dynamics')).toBe('Data Center Dynamics');
  });

  it('writes null and empty values as an empty cell', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell('')).toBe('');
  });

  it('quotes a cell with a comma, a quote or a line break and doubles inner quotes', () => {
    expect(csvCell('cooling, AI')).toBe('"cooling, AI"');
    expect(csvCell('האם התרופה לסרטן תצא מישראל? "תרופות ב-60 מיליארד דולר בשנה"')).toBe(
      '"האם התרופה לסרטן תצא מישראל? ""תרופות ב-60 מיליארד דולר בשנה"""',
    );
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
    expect(csvCell('carriage\rreturn')).toBe('"carriage\rreturn"');
  });

  it.each(['=HYPERLINK("http://evil.example","click")', '+1+1', '-2+3', '@SUM(A1:A2)', '\tindent'])(
    'neutralises a cell a spreadsheet would read as a formula: %j',
    (value) => {
      const cell = csvCell(value);

      expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('keeps a neutralised formula quoted when it also needs quoting', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });

  it('does not touch formula characters after the first one', () => {
    expect(csvCell('Up 5% = record')).toBe('Up 5% = record');
  });
});

describe('csvDocument', () => {
  it('starts with a UTF-8 byte order mark and ends every line with CRLF', () => {
    const document = csvDocument(['a', 'b'], [['1', null], ['x,y', '2']]);

    expect(document).toBe('\uFEFFa,b\r\n1,\r\n"x,y",2\r\n');
  });

  it('writes only the header when there are no rows', () => {
    expect(csvDocument(['company'], [])).toBe('\uFEFFcompany\r\n');
  });
});
