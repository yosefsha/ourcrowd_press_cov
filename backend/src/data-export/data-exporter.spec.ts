import { DataExportFailed } from './data-exporter';

describe('DataExportFailed', () => {
  it('is a named Error that keeps its cause', () => {
    const cause = new Error('ENOSPC');
    const error = new DataExportFailed('cannot write data/', { cause });

    expect(error.name).toBe('DataExportFailed');
    expect(error.cause).toBe(cause);
  });
});
